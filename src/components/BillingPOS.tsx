import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Printer,
  CreditCard,
  Banknote,
  QrCode,
  User,
  Stethoscope,
  AlertCircle,
  Clock,
  CheckCircle2,
  X,
  FileText,
  RotateCcw,
  PauseCircle,
  PlayCircle,
  HelpCircle,
  MapPin,
  ShieldAlert,
  LogOut,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../db/db';
import {
  Medicine,
  Batch,
  CartItem,
  Customer,
  Doctor,
  Invoice,
  StoreSettings,
  HeldBill,
  PaymentMode,
} from '../types';
import {
  formatCurrency,
  checkExpiryStatus,
  calculateLineItemPricing,
  generateUpiQrUri,
} from '../utils/formatters';
import { PrintReceipt } from './PrintReceipt';
import { syncInvoiceToCloud, syncBatchToCloud, syncCustomerToCloud } from '../firebase/firestoreService';
import { useBillingDraft } from '../context/BillingDraftContext';

interface BillingPOSProps {
  settings: StoreSettings | null;
  onRefreshStats: () => void;
  isActive?: boolean;
  onExit?: () => void;
}

export const BillingPOS: React.FC<BillingPOSProps> = ({ settings, onRefreshStats, isActive = true, onExit }) => {
  const symbol = settings?.currencySymbol || '₹';

  // Shared billing draft state (survives tab switching and reloads)
  const {
    customerPhone,
    setCustomerPhone,
    customerName,
    setCustomerName,
    selectedCustomer,
    setSelectedCustomer,
    doctorName,
    setDoctorName,
    doctorRegNo,
    setDoctorRegNo,
    cart,
    setCart,
    overallDiscountPercent,
    setOverallDiscountPercent,
    billNotes,
    setBillNotes,
    clearDraft,
    holdDraft,
    syncDraftFromStorage,
    subtotal,
    totalDiscount,
    taxableAmount,
    totalGst,
    cgstAmount,
    sgstAmount,
    grandTotal,
    roundOff,
    hasActiveDraft,
  } = useBillingDraft();

  // Suggestions & doctors
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);

  // Inventory & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [allMedicines, setAllMedicines] = useState<Medicine[]>([]);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [searchResults, setSearchResults] = useState<{ medicine: Medicine; batches: Batch[] }[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Held Bills state
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [isHeldBillsModalOpen, setIsHeldBillsModalOpen] = useState(false);

  // Settlement & Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [tenderedAmount, setTenderedAmount] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Completed Invoice & Print Modal state
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState<'thermal-80mm' | 'a4-tax-invoice'>(
    settings?.printFormat === 'a4-tax-invoice' ? 'a4-tax-invoice' : 'thermal-80mm'
  );

  // Refs for keyboard shortcuts & modals
  const searchInputRef = useRef<HTMLInputElement>(null);
  const paymentDialogRef = useRef<HTMLDialogElement>(null);
  const printDialogRef = useRef<HTMLDialogElement>(null);
  const heldBillsDialogRef = useRef<HTMLDialogElement>(null);

  // Load initial data
  const loadData = async () => {
    const meds = await db.medicines.toArray();
    const batches = await db.batches.toArray();
    const docs = await db.doctors.toArray();
    const held = await db.heldBills.toArray();
    setAllMedicines(meds);
    setAllBatches(batches);
    setDoctorsList(docs);
    setHeldBills(held);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Refresh data when switching to this tab, and close dialogs when switching away
  useEffect(() => {
    if (isActive) {
      loadData();
      // Ensure all draft values (patient mobile, name, doctor, items) are fresh from storage
      syncDraftFromStorage();
      // Sync available stock for items currently in cart with latest batches
      db.batches.toArray().then((latestBatches) => {
        setCart((currentCart) => {
          if (currentCart.length === 0) return currentCart;
          return currentCart.map((item) => {
            const matched = latestBatches.find((b) => b.id === item.batchId);
            if (matched && matched.stockQty !== item.availableStock) {
              return { ...item, availableStock: matched.stockQty };
            }
            return item;
          });
        });
      });
    } else {
      // Close open modal dialogs if user switches to another tab
      if (isPaymentModalOpen) {
        setIsPaymentModalOpen(false);
        paymentDialogRef.current?.close();
      }
      if (isHeldBillsModalOpen) {
        setIsHeldBillsModalOpen(false);
        heldBillsDialogRef.current?.close();
      }
      if (isPrintModalOpen) {
        setIsPrintModalOpen(false);
        printDialogRef.current?.close();
      }
    }
  }, [isActive, syncDraftFromStorage, setCart]);

  // Keyboard shortcut listener (F2: Focus Search, F4: Search, F8: Hold, F9: Settle)
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) handleHoldBill();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0 && !isPaymentModalOpen) {
          openPaymentModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, cart, isPaymentModalOpen, customerName, customerPhone, doctorName]);

  // Search medicines & generic names
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearchOpen(false);
      return;
    }

    const q = searchQuery.toLowerCase().trim();
    const filteredMeds = allMedicines.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.rack.toLowerCase().includes(q)
    );

    // Also search by batch barcode
    const matchedBarcodeBatch = allBatches.filter((b) => b.barcode && b.barcode.toLowerCase() === q);
    const barcodeMedIds = new Set(matchedBarcodeBatch.map((b) => b.medicineId));

    const combinedMeds = [
      ...filteredMeds,
      ...allMedicines.filter((m) => barcodeMedIds.has(m.id) && !filteredMeds.some((f) => f.id === m.id)),
    ];

    const results = combinedMeds.slice(0, 8).map((medicine) => {
      const batches = allBatches.filter((b) => b.medicineId === medicine.id);
      return { medicine, batches };
    });

    setSearchResults(results);
    setIsSearchOpen(true);
  }, [searchQuery, allMedicines, allBatches]);

  // Customer phone suggestions
  const handlePhoneChange = async (val: string) => {
    setCustomerPhone(val);
    if (val.length >= 3) {
      const matches = await db.customers.where('phone').startsWithIgnoreCase(val).limit(4).toArray();
      setCustomerSuggestions(matches);
    } else {
      setCustomerSuggestions([]);
    }
  };

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    if (c.doctorName) setDoctorName(c.doctorName);
    setCustomerSuggestions([]);
  };

  // Add medicine to cart
  const handleAddToCart = (medicine: Medicine, preferredBatch?: Batch) => {
    const medBatches = allBatches.filter((b) => b.medicineId === medicine.id);
    if (medBatches.length === 0) {
      alert(`No batch exists for ${medicine.name}. Please add stock batch in Inventory.`);
      return;
    }

    // Default to the specified batch or the earliest expiring batch that is in stock
    let chosenBatch = preferredBatch;
    if (!chosenBatch) {
      const availableBatches = medBatches.filter((b) => b.stockQty > 0);
      const candidates = availableBatches.length > 0 ? availableBatches : medBatches;
      chosenBatch = candidates.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
    }

    // Check expiry
    const expStatus = checkExpiryStatus(chosenBatch.expiryDate);
    if (expStatus.status === 'expired') {
      const proceed = confirm(
        `WARNING: Batch ${chosenBatch.batchNumber} of ${medicine.name} is EXPIRED (${chosenBatch.expiryDate})! Do you still want to proceed?`
      );
      if (!proceed) return;
    }

    // Check if already in cart
    const existingIndex = cart.findIndex(
      (item) => item.medicineId === medicine.id && item.batchId === chosenBatch!.id
    );

    if (existingIndex > -1) {
      // Increment quantity
      const existing = cart[existingIndex];
      const newQty = existing.qty + 1;
      updateCartItemQty(existingIndex, newQty);
    } else {
      const pricing = calculateLineItemPricing(
        1,
        chosenBatch.saleRate,
        overallDiscountPercent,
        medicine.defaultGstPercent
      );

      const newItem: CartItem = {
        medicineId: medicine.id,
        batchId: chosenBatch.id,
        medicineName: medicine.name,
        genericName: medicine.genericName,
        manufacturer: medicine.manufacturer,
        category: medicine.category,
        rackLocation: `${medicine.rack} - ${medicine.shelf}`,
        schedule: medicine.schedule,
        batchNumber: chosenBatch.batchNumber,
        expiryDate: chosenBatch.expiryDate,
        unit: medicine.unit,
        packSize: medicine.packSize,
        availableStock: chosenBatch.stockQty,
        qty: 1,
        freeQty: 0,
        mrp: chosenBatch.mrp,
        unitRate: chosenBatch.saleRate,
        discountPercent: overallDiscountPercent,
        gstPercent: medicine.defaultGstPercent,
        taxableAmount: pricing.taxableAmount,
        gstAmount: pricing.gstAmount,
        totalAmount: pricing.totalAmount,
      };

      setCart([...cart, newItem]);
    }

    setSearchQuery('');
    setIsSearchOpen(false);
    searchInputRef.current?.focus();
  };

  // Update Item Quantity
  const updateCartItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }

    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const pricing = calculateLineItemPricing(newQty, item.unitRate, item.discountPercent, item.gstPercent);
      updated[index] = {
        ...item,
        qty: newQty,
        taxableAmount: pricing.taxableAmount,
        gstAmount: pricing.gstAmount,
        totalAmount: pricing.totalAmount,
      };
      return updated;
    });
  };

  // Update Free Quantity
  const updateCartItemFreeQty = (index: number, freeQty: number) => {
    setCart((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], freeQty: Math.max(0, freeQty) };
      return updated;
    });
  };

  // Update Line Item Discount %
  const updateCartItemDiscount = (index: number, disc: number) => {
    const clampedDisc = Math.min(100, Math.max(0, disc));
    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const pricing = calculateLineItemPricing(item.qty, item.unitRate, clampedDisc, item.gstPercent);
      updated[index] = {
        ...item,
        discountPercent: clampedDisc,
        taxableAmount: pricing.taxableAmount,
        gstAmount: pricing.gstAmount,
        totalAmount: pricing.totalAmount,
      };
      return updated;
    });
  };

  // Switch batch for an item in cart
  const handleSwitchBatch = (cartIndex: number, newBatchId: string) => {
    const newBatch = allBatches.find((b) => b.id === newBatchId);
    if (!newBatch) return;

    setCart((prev) => {
      const updated = [...prev];
      const item = updated[cartIndex];
      const pricing = calculateLineItemPricing(item.qty, newBatch.saleRate, item.discountPercent, item.gstPercent);
      updated[cartIndex] = {
        ...item,
        batchId: newBatch.id,
        batchNumber: newBatch.batchNumber,
        expiryDate: newBatch.expiryDate,
        mrp: newBatch.mrp,
        unitRate: newBatch.saleRate,
        availableStock: newBatch.stockQty,
        taxableAmount: pricing.taxableAmount,
        gstAmount: pricing.gstAmount,
        totalAmount: pricing.totalAmount,
      };
      return updated;
    });
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // Clear Cart
  const handleClearCart = () => {
    if (hasActiveDraft && !confirm('Clear current bill details?')) return;
    clearDraft();
    searchInputRef.current?.focus();
  };

  // Apply overall discount to all items
  const handleApplyOverallDiscount = (percent: number) => {
    setOverallDiscountPercent(percent);
    setCart((prev) =>
      prev.map((item) => {
        const pricing = calculateLineItemPricing(item.qty, item.unitRate, percent, item.gstPercent);
        return {
          ...item,
          discountPercent: percent,
          taxableAmount: pricing.taxableAmount,
          gstAmount: pricing.gstAmount,
          totalAmount: pricing.totalAmount,
        };
      })
    );
  };

  // Hold Bill
  const handleHoldBill = async () => {
    if (cart.length === 0) return;
    const ok = await holdDraft(symbol);
    if (ok) {
      await loadData();
      onRefreshStats();
      alert('Bill saved to Held Queue! You can recall it anytime.');
    }
  };

  // Resume Held Bill
  const handleResumeBill = async (held: HeldBill) => {
    if (cart.length > 0 && !confirm('Replace current cart with held bill?')) return;
    setCart(held.items);
    setCustomerName(held.customerName === 'Walk-in Customer' ? '' : held.customerName);
    setCustomerPhone(held.customerPhone);
    setDoctorName(held.doctorName || '');
    await db.heldBills.delete(held.id);
    await loadData();
    onRefreshStats();
    setIsHeldBillsModalOpen(false);
    heldBillsDialogRef.current?.close();
  };

  // Open Payment Modal
  const openPaymentModal = () => {
    setTenderedAmount(grandTotal.toString());
    setIsPaymentModalOpen(true);
    paymentDialogRef.current?.showModal();
  };

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    paymentDialogRef.current?.close();
  };

  // Settle Bill & Save
  const handleSettleAndSaveBill = async () => {
    if (cart.length === 0) return;
    setIsSaving(true);

    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const currentYearMonth = dateStr.substring(0, 7);

      // Generate invoice number
      const invoiceCount = await db.invoices.count();
      const invoiceNo = `INV-${now.getFullYear()}-${String(invoiceCount + 1).padStart(4, '0')}`;

      // Calculate paid & credit
      const numTendered = parseFloat(tenderedAmount) || 0;
      let paid = grandTotal;
      let change = 0;
      let credit = 0;

      if (paymentMode === 'cash') {
        if (numTendered >= grandTotal) {
          paid = grandTotal;
          change = numTendered - grandTotal;
        } else {
          paid = numTendered;
          credit = grandTotal - numTendered;
        }
      } else if (paymentMode === 'credit') {
        paid = 0;
        credit = grandTotal;
      }

      // Customer handling: Save customer or update balance if credit
      let custId = selectedCustomer?.id;
      const cleanPhone = customerPhone.trim();
      const cleanName = customerName.trim();

      if (!custId && (cleanPhone || cleanName)) {
        let existing = cleanPhone
          ? await db.customers.where('phone').equals(cleanPhone).first()
          : null;
        if (!existing && cleanName) {
          existing = await db.customers.where('name').equalsIgnoreCase(cleanName).first();
        }
        if (existing) {
          custId = existing.id;
        } else {
          custId = `cust-${Date.now()}`;
          const newCust: Customer = {
            id: custId,
            name: cleanName || 'Regular Customer',
            phone: cleanPhone || 'N/A',
            outstandingBalance: 0,
            totalPurchases: 0,
            doctorName: doctorName.trim() || undefined,
            createdAt: now.toISOString(),
          };
          await db.customers.put(newCust);
          syncCustomerToCloud(newCust);
        }
      }

      if (custId) {
        const cust = await db.customers.get(custId);
        if (cust) {
          const updatedCust = {
            outstandingBalance: cust.outstandingBalance + credit,
            totalPurchases: cust.totalPurchases + grandTotal,
            doctorName: doctorName.trim() || cust.doctorName,
          };
          await db.customers.update(custId, updatedCust);
          syncCustomerToCloud({ ...cust, ...updatedCust });
        }
      }

      // Build invoice object
      const newInvoice: Invoice = {
        id: `inv-${Date.now()}`,
        invoiceNo,
        date: dateStr,
        time: timeStr,
        customerId: custId,
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim(),
        doctorName: doctorName.trim(),
        doctorRegNo: doctorRegNo.trim(),
        items: [...cart],
        subtotal,
        totalDiscount,
        taxableAmount,
        totalGst,
        cgstAmount,
        sgstAmount,
        roundOff,
        grandTotal,
        paymentMode,
        paidAmount: paid,
        changeDue: change,
        creditAmount: credit,
        status: credit > 0 && paid === 0 ? 'credit' : 'paid',
        notes: billNotes,
        createdYearMonth: currentYearMonth,
      };

      // Deduct stock from batches
      await db.transaction('rw', [db.batches, db.invoices], async () => {
        for (const item of cart) {
          const totalDeduct = item.qty + item.freeQty;
          const batch = await db.batches.get(item.batchId);
          if (batch) {
            const updatedStock = Math.max(0, batch.stockQty - totalDeduct);
            await db.batches.update(batch.id, { stockQty: updatedStock });
          }
        }
        await db.invoices.put(newInvoice);
      });

      // Synchronize with Firebase Cloud Firestore in background
      syncInvoiceToCloud(newInvoice);
      for (const item of cart) {
        db.batches.get(item.batchId).then((b) => {
          if (b) syncBatchToCloud(b);
        });
      }
      if (custId) {
        db.customers.get(custId).then((c) => {
          if (c) syncCustomerToCloud(c);
        });
      }

      // Close payment modal
      closePaymentModal();

      // Show Print Modal
      setCompletedInvoice(newInvoice);
      setIsPrintModalOpen(true);
      printDialogRef.current?.showModal();

      // Reset cart and reload database
      clearDraft();
      await loadData();
      onRefreshStats();
    } catch (err) {
      console.error('Error saving invoice:', err);
      alert('Failed to save bill. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasScheduleDrugs = cart.some(
    (item) => item.schedule === 'Schedule H' || item.schedule === 'Schedule H1' || item.schedule === 'Schedule X'
  );

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Top Customer & Doctor Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Customer Mobile with Suggestions */}
          <div className="md:col-span-3 relative">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              Patient Mobile / Phone
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="Search or enter 10 digits"
              className="w-full px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white"
            />
            {customerSuggestions.length > 0 && (
              <div className="absolute left-0 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-30 max-h-48 overflow-y-auto">
                {customerSuggestions.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    className="p-2 hover:bg-emerald-50 cursor-pointer border-b border-slate-100 flex justify-between items-center text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-800">{c.name}</div>
                      <div className="text-slate-500 font-mono">{c.phone}</div>
                    </div>
                    {c.outstandingBalance > 0 && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                        Khata: {formatCurrency(c.outstandingBalance, symbol)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer Name */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Patient / Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Rajesh Sharma"
              className="w-full px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Prescribing Doctor */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
              Prescribing Doctor
            </label>
            <div className="relative">
              <input
                type="text"
                list="doctors-datalist"
                value={doctorName}
                onChange={(e) => {
                  setDoctorName(e.target.value);
                  const matched = doctorsList.find((d) => d.name === e.target.value);
                  if (matched && matched.regNo) setDoctorRegNo(matched.regNo);
                }}
                placeholder="Doctor Name or Select"
                className="w-full px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 focus:bg-white"
              />
              <datalist id="doctors-datalist">
                {doctorsList.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.specialization ? `${d.name} (${d.specialization})` : d.name}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          {/* Bill Action Buttons: Hold, Recall, Clear */}
          <div className="md:col-span-3 flex items-center justify-end space-x-2 pt-4 md:pt-0">
            {(cart.length > 0 || customerName.trim() !== '' || customerPhone.trim() !== '') && (
              <span
                className="hidden xl:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200"
                title="Current bill draft is automatically preserved across sections"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Draft Active
              </span>
            )}

            <button
              onClick={handleHoldBill}
              disabled={cart.length === 0}
              title="Hold this bill (F8)"
              className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              <span>Hold (F8)</span>
            </button>

            {heldBills.length > 0 && (
              <button
                onClick={() => {
                  setIsHeldBillsModalOpen(true);
                  heldBillsDialogRef.current?.showModal();
                }}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 flex items-center gap-1 shadow-sm animate-pulse"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Resume ({heldBills.length})</span>
              </button>
            )}

            <button
              onClick={handleClearCart}
              title="Start a new blank bill"
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New Bill</span>
            </button>

            {onExit && (
              <button
                type="button"
                onClick={onExit}
                title="Exit POS and return to Dashboard"
                className="px-2.5 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 flex items-center gap-1 shadow-xs transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
                <span>Exit POS</span>
              </button>
            )}
          </div>
        </div>

        {/* Customer Khata Warning banner if outstanding exists */}
        {selectedCustomer && selectedCustomer.outstandingBalance > 0 && (
          <div className="mt-2.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                Customer has prior Khata Credit Balance of{' '}
                <strong>{formatCurrency(selectedCustomer.outstandingBalance, symbol)}</strong>
              </span>
            </div>
            <span className="text-[11px] font-mono text-red-600">Total Purchases: {formatCurrency(selectedCustomer.totalPurchases, symbol)}</span>
          </div>
        )}
      </div>

      {/* Main POS Interface: Split into Left Cart Area (8 cols) and Right Summary Area (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Medicine Search & Cart Table */}
        <div className="lg:col-span-8 space-y-3">
          {/* Medicine Search Input Bar */}
          <div className="relative">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchQuery.trim()) setIsSearchOpen(true);
                }}
                placeholder="Press F4 to Search Medicine (Brand Name, Generic Salt, Barcode, or Rack)..."
                className="w-full pl-11 pr-24 py-3 bg-white text-slate-900 border-2 border-emerald-500 rounded-xl shadow-md text-base font-medium focus:ring-4 focus:ring-emerald-500/20 focus:outline-none placeholder:text-slate-400"
              />
              <div className="absolute right-3 flex items-center space-x-1.5">
                <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-300 px-2 py-0.5 rounded">
                  F4
                </span>
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setIsSearchOpen(false);
                    }}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Live Search Suggestions Dropdown */}
            {isSearchOpen && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-300 rounded-xl shadow-2xl z-40 max-h-96 overflow-y-auto divide-y divide-slate-100">
                {searchResults.map(({ medicine, batches }) => {
                  const totalStock = batches.reduce((sum, b) => sum + b.stockQty, 0);
                  const isOutOfStock = totalStock <= 0;

                  return (
                    <div
                      key={medicine.id}
                      className={`p-3 transition-colors ${
                        isOutOfStock ? 'bg-slate-50 opacity-60' : 'hover:bg-emerald-50/70'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{medicine.name}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                medicine.schedule === 'Schedule H' || medicine.schedule === 'Schedule H1'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {medicine.schedule}
                            </span>
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                              {medicine.category}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            <span className="font-medium text-emerald-800">{medicine.genericName}</span> &bull; {medicine.manufacturer}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-1">
                            <MapPin className="w-3 h-3 text-amber-600" />
                            <span>
                              Location: <strong>{medicine.rack} - {medicine.shelf}</strong>
                            </span>
                            <span>&bull; Pack: {medicine.packSize} / {medicine.unit}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-bold text-slate-800">
                            Total Stock: <span className={totalStock <= 5 ? 'text-red-600 font-bold' : 'text-emerald-700'}>{totalStock}</span>
                          </div>
                          <button
                            onClick={() => handleAddToCart(medicine)}
                            disabled={isOutOfStock}
                            className="mt-1.5 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:bg-slate-300 flex items-center gap-1 ml-auto shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>
                        </div>
                      </div>

                      {/* Batches available under this medicine */}
                      {batches.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                          {batches.map((b) => {
                            const exp = checkExpiryStatus(b.expiryDate);
                            return (
                              <button
                                key={b.id}
                                onClick={() => handleAddToCart(medicine, b)}
                                className={`text-[10px] px-2 py-1 rounded border flex items-center gap-1.5 transition-all ${
                                  b.stockQty === 0
                                    ? 'bg-gray-100 text-gray-400 border-gray-200'
                                    : 'bg-white hover:border-emerald-500 hover:shadow-sm'
                                }`}
                              >
                                <span className="font-mono font-bold text-slate-800">B:{b.batchNumber}</span>
                                <span className={`px-1 rounded text-[9px] ${exp.badgeClass}`}>{exp.label}</span>
                                <span className="text-slate-600">Stock: {b.stockQty}</span>
                                <span className="font-bold text-emerald-700">{formatCurrency(b.saleRate, symbol)}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Schedule Drug Warning Flag */}
          {hasScheduleDrugs && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-2.5 text-xs text-amber-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Schedule H / H1 Drugs in Bill:</strong> Doctor prescription and patient register entry are mandatory by drug law.
              </span>
            </div>
          )}

          {/* Cart Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-900 text-white flex justify-between items-center text-xs font-bold">
              <span className="uppercase tracking-wider">Cart Medicines ({cart.length} items)</span>
              <span className="text-slate-400 font-normal">
                Use Enter or arrow keys to adjust quantities
              </span>
            </div>

            {cart.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Search className="w-8 h-8" />
                </div>
                <p className="text-base font-semibold text-slate-600">No items added to current bill</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Type in the search bar above or press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded font-mono text-slate-700">F4</kbd> to search medicines by brand name, salt, or scan barcode.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Medicine & Salt</th>
                      <th className="py-2.5 px-2">Rack</th>
                      <th className="py-2.5 px-2">Batch / Exp</th>
                      <th className="py-2.5 px-2 text-center w-20">Qty</th>
                      <th className="py-2.5 px-2 text-center w-14">Free</th>
                      <th className="py-2.5 px-2 text-right">MRP</th>
                      <th className="py-2.5 px-2 text-right">Rate</th>
                      <th className="py-2.5 px-2 text-center w-16">Disc %</th>
                      <th className="py-2.5 px-2 text-right">GST %</th>
                      <th className="py-2.5 px-2 text-right">Total</th>
                      <th className="py-2.5 px-2 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {cart.map((item, idx) => {
                      const exp = checkExpiryStatus(item.expiryDate);
                      const itemBatches = allBatches.filter((b) => b.medicineId === item.medicineId);

                      return (
                        <tr key={`${item.medicineId}-${item.batchId}-${idx}`} className="hover:bg-slate-50/80">
                          {/* Medicine Name & Schedule */}
                          <td className="py-2 px-3">
                            <div className="font-bold text-slate-900">{item.medicineName}</div>
                            <div className="text-[10px] text-slate-500">{item.genericName}</div>
                            {item.schedule !== 'OTC' && (
                              <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-1 rounded">
                                {item.schedule}
                              </span>
                            )}
                          </td>

                          {/* Rack Location */}
                          <td className="py-2 px-2 text-[11px] font-mono text-slate-600">
                            {item.rackLocation}
                          </td>

                          {/* Batch Selection & Expiry */}
                          <td className="py-2 px-2">
                            {itemBatches.length > 1 ? (
                              <select
                                value={item.batchId}
                                onChange={(e) => handleSwitchBatch(idx, e.target.value)}
                                className="text-[11px] font-mono border border-slate-300 rounded px-1 py-0.5 bg-white font-semibold"
                              >
                                {itemBatches.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.batchNumber} (Exp: {b.expiryDate} - Stk: {b.stockQty})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="font-mono font-semibold text-slate-800">{item.batchNumber}</div>
                            )}
                            <div className="mt-0.5">
                              <span className={`text-[9px] px-1 rounded font-bold ${exp.badgeClass}`}>
                                {exp.label}
                              </span>
                            </div>
                          </td>

                          {/* Quantity with +/- */}
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => updateCartItemQty(idx, item.qty - 1)}
                                className="w-5 h-5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold flex items-center justify-center text-xs"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={(e) => updateCartItemQty(idx, parseInt(e.target.value, 10) || 0)}
                                className="w-12 py-1 text-center font-bold text-slate-900 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500"
                              />
                              <button
                                onClick={() => updateCartItemQty(idx, item.qty + 1)}
                                className="w-5 h-5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold flex items-center justify-center text-xs"
                              >
                                +
                              </button>
                            </div>
                            <div className="text-[9px] text-slate-400 mt-0.5">Avail: {item.availableStock}</div>
                          </td>

                          {/* Free Quantity (Bonus Scheme) */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={item.freeQty}
                              onChange={(e) => updateCartItemFreeQty(idx, parseInt(e.target.value, 10) || 0)}
                              className="w-10 py-1 text-center text-slate-700 border border-slate-300 rounded text-xs"
                              placeholder="0"
                            />
                          </td>

                          {/* MRP */}
                          <td className="py-2 px-2 text-right text-slate-500 font-mono">
                            {item.mrp.toFixed(2)}
                          </td>

                          {/* Rate */}
                          <td className="py-2 px-2 text-right font-semibold text-slate-800 font-mono">
                            {item.unitRate.toFixed(2)}
                          </td>

                          {/* Discount % */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discountPercent}
                              onChange={(e) => updateCartItemDiscount(idx, parseFloat(e.target.value) || 0)}
                              className="w-12 py-1 text-center font-semibold text-emerald-700 border border-slate-300 rounded text-xs"
                            />
                          </td>

                          {/* GST % */}
                          <td className="py-2 px-2 text-right text-slate-500 font-mono">
                            {item.gstPercent}%
                          </td>

                          {/* Line Item Total */}
                          <td className="py-2 px-2 text-right font-black text-slate-900 text-sm font-mono">
                            {item.totalAmount.toFixed(2)}
                          </td>

                          {/* Delete Item */}
                          <td className="py-2 px-2 text-center">
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="text-red-400 hover:text-red-600 p-1"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Calculations & Bill Settlement */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3 sticky top-20">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2">
              Bill Summary
            </h3>

            {/* Quick Overall Discount Control */}
            <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-700">Apply Bill Discount:</span>
              <div className="flex items-center space-x-1.5">
                {[0, 5, 10, 15].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handleApplyOverallDiscount(pct)}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                      overallDiscountPercent === pct
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Summary Line Items */}
            <div className="space-y-2 text-xs pt-1">
              <div className="flex justify-between text-slate-600">
                <span>Total Items / Pieces:</span>
                <span className="font-mono font-bold text-slate-800">
                  {cart.length} items ({cart.reduce((s, i) => s + i.qty, 0)} units)
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Gross MRP):</span>
                <span className="font-mono font-semibold">{formatCurrency(subtotal, symbol)}</span>
              </div>

              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Total Discount:</span>
                  <span className="font-mono">- {formatCurrency(totalDiscount, symbol)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Taxable Amount:</span>
                <span className="font-mono">{formatCurrency(taxableAmount, symbol)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Total GST (CGST+SGST):</span>
                <span className="font-mono">{formatCurrency(totalGst, symbol)}</span>
              </div>

              {roundOff !== 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Round Off:</span>
                  <span className="font-mono">{roundOff > 0 ? `+${roundOff}` : roundOff}</span>
                </div>
              )}

              {/* Big Grand Total Box */}
              <div className="mt-3 p-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 rounded-xl text-white shadow-md">
                <div className="text-[11px] uppercase font-bold text-emerald-100 tracking-wider">
                  Total Amount Payable
                </div>
                <div className="text-3xl font-black font-mono tracking-tight mt-0.5">
                  {formatCurrency(grandTotal, symbol)}
                </div>
              </div>
            </div>

            {/* Settle Bill Button */}
            <button
              onClick={openPaymentModal}
              disabled={cart.length === 0}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-base rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
            >
              <CreditCard className="w-5 h-5" />
              <span>SETTLE BILL & PAY (F9)</span>
            </button>

            {/* Quick Keyboard Helpers */}
            <div className="pt-2 text-[10px] text-slate-400 flex justify-between border-t border-slate-100">
              <span><strong>F2:</strong> POS</span>
              <span><strong>F4:</strong> Search</span>
              <span><strong>F8:</strong> Hold</span>
              <span><strong>F9:</strong> Settle</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= PAYMENT / SETTLEMENT MODAL ================= */}
      <dialog
        ref={paymentDialogRef}
        aria-labelledby="payment-dialog-title"
        closedby="any"
        className="rounded-2xl p-0 backdrop:bg-slate-900/60 shadow-2xl max-w-lg w-full text-slate-900 overflow-hidden border border-slate-200"
      >
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 id="payment-dialog-title" className="text-lg font-bold">
              Complete Payment & Checkout
            </h2>
            <p className="text-xs text-slate-400">Total Payable: {formatCurrency(grandTotal, symbol)}</p>
          </div>
          <button
            onClick={closePaymentModal}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Payment Mode Selector */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider mb-2">
              Select Payment Mode
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'cash', label: 'Cash', icon: Banknote },
                { id: 'upi', label: 'UPI / QR', icon: QrCode },
                { id: 'card', label: 'Card / POS', icon: CreditCard },
                { id: 'credit', label: 'Khata (Due)', icon: User },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setPaymentMode(m.id as PaymentMode);
                      if (m.id === 'cash') setTenderedAmount(grandTotal.toString());
                      if (m.id === 'credit') setTenderedAmount('0');
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic mode-specific content */}
          {paymentMode === 'cash' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cash Amount Received from Customer:
                </label>
                <input
                  type="number"
                  autoFocus
                  value={tenderedAmount}
                  onChange={(e) => setTenderedAmount(e.target.value)}
                  className="w-full text-xl font-bold font-mono px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                  placeholder="0.00"
                />
              </div>

              {/* Quick Cash Denomination buttons */}
              <div className="flex gap-2">
                {[grandTotal, Math.ceil(grandTotal / 100) * 100, 500, 1000, 2000].map(
                  (val) =>
                    val >= grandTotal && (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setTenderedAmount(val.toString())}
                        className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-100"
                      >
                        {formatCurrency(val, symbol)}
                      </button>
                    )
                )}
              </div>

              {/* Change calculation */}
              {parseFloat(tenderedAmount) >= grandTotal && (
                <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-lg flex justify-between items-center text-emerald-900">
                  <span className="font-bold text-xs uppercase">Change to Return:</span>
                  <span className="text-xl font-black font-mono">
                    {formatCurrency(parseFloat(tenderedAmount) - grandTotal, symbol)}
                  </span>
                </div>
              )}
            </div>
          )}

          {paymentMode === 'upi' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-2">
              <p className="text-xs font-bold text-slate-700">
                Scan QR Code with Google Pay, PhonePe, Paytm, or BHIM:
              </p>
              <div className="p-2 bg-white inline-block border-2 border-emerald-500 rounded-xl shadow-sm">
                <QRCodeSVG
                  value={generateUpiQrUri(
                    settings?.upiId || 'pharmacy@upi',
                    settings?.storeName?.replace('& SURGICALS', '').trim() || 'Pharmacy',
                    grandTotal,
                    `POS-${Date.now().toString().slice(-4)}`
                  )}
                  size={140}
                  level="M"
                />
              </div>
              <p className="text-xs font-mono font-bold text-slate-800">
                Pay Exactly: {formatCurrency(grandTotal, symbol)}
              </p>
              <p className="text-[11px] text-slate-500">UPI ID: {settings?.upiId || 'Not configured in Settings'}</p>
            </div>
          )}

          {paymentMode === 'credit' && (
            <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-xs text-red-900 space-y-1">
              <p className="font-bold text-sm">Customer Khata (Credit Bill)</p>
              <p>
                The full bill amount of <strong>{formatCurrency(grandTotal, symbol)}</strong> will be added to{' '}
                <strong>{customerName || 'Customer'}</strong>'s account ledger balance.
              </p>
              {!customerPhone && (
                <p className="text-red-600 font-semibold mt-2">
                  Please make sure Customer Phone is entered above so the Khata can be tracked accurately!
                </p>
              )}
            </div>
          )}

          {/* Bill Notes / Doctor remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Bill Remarks / Prescription Note (Optional)
            </label>
            <input
              type="text"
              value={billNotes}
              onChange={(e) => setBillNotes(e.target.value)}
              placeholder="e.g. 5 days dosage, follow up next week"
              className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="bg-slate-100 px-6 py-4 flex justify-between items-center border-t border-slate-200">
          <button
            type="button"
            onClick={closePaymentModal}
            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSettleAndSaveBill}
            disabled={isSaving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-black shadow-md flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? (
              <span>Saving...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>CONFIRM & PRINT BILL</span>
              </>
            )}
          </button>
        </div>
      </dialog>

      {/* ================= PRINT PREVIEW MODAL ================= */}
      <dialog
        ref={printDialogRef}
        aria-labelledby="print-dialog-title"
        closedby="any"
        className="rounded-xl sm:rounded-2xl p-0 backdrop:bg-slate-900/60 shadow-2xl max-w-4xl w-[96vw] sm:w-full text-slate-900 overflow-hidden border border-slate-200 m-auto"
      >
        <div className="bg-slate-900 text-white p-3 sm:px-6 sm:py-3.5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 print:hidden">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div className="min-w-0">
              <h2 id="print-dialog-title" className="text-sm sm:text-base font-bold truncate">
                Invoice: {completedInvoice?.invoiceNo}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                {completedInvoice?.customerName || 'Cash Customer'} &bull; {completedInvoice?.date} {completedInvoice?.time}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsPrintModalOpen(false);
                printDialogRef.current?.close();
              }}
              className="p-1 text-slate-400 hover:text-white sm:hidden rounded-lg shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <div className="flex bg-slate-800 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setPrintFormat('thermal-80mm')}
                className={`px-2.5 sm:px-3 py-1 rounded-md font-bold transition-all text-[11px] sm:text-xs ${
                  printFormat === 'thermal-80mm' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Thermal 80mm
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('a4-tax-invoice')}
                className={`px-2.5 sm:px-3 py-1 rounded-md font-bold transition-all text-[11px] sm:text-xs ${
                  printFormat === 'a4-tax-invoice' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                A4 Tax Invoice
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 sm:px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-sm shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPrintModalOpen(false);
                printDialogRef.current?.close();
              }}
              className="hidden sm:flex p-1.5 text-slate-400 hover:text-white rounded-lg shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice View Area */}
        <div className="p-2 sm:p-6 bg-slate-100 max-h-[80vh] overflow-y-auto overflow-x-auto">
          {completedInvoice && (
            <PrintReceipt invoice={completedInvoice} settings={settings} format={printFormat} />
          )}
        </div>
      </dialog>

      {/* ================= HELD BILLS MODAL ================= */}
      <dialog
        ref={heldBillsDialogRef}
        aria-labelledby="held-dialog-title"
        closedby="any"
        className="rounded-2xl p-0 backdrop:bg-slate-900/60 shadow-2xl max-w-xl w-full text-slate-900 overflow-hidden border border-slate-200"
      >
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 id="held-dialog-title" className="text-base font-bold">
              Held Bills Queue ({heldBills.length})
            </h2>
            <p className="text-xs text-slate-400">Select any held bill to resume checkout</p>
          </div>
          <button
            onClick={() => {
              setIsHeldBillsModalOpen(false);
              heldBillsDialogRef.current?.close();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
          {heldBills.length === 0 ? (
            <p className="text-center text-slate-500 py-8 text-xs">No held bills in queue.</p>
          ) : (
            heldBills.map((held) => (
              <div
                key={held.id}
                className="p-3 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 flex justify-between items-center shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{held.customerName}</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {held.holdTime}
                    </span>
                  </div>
                  {held.customerPhone && (
                    <div className="text-xs text-slate-500 font-mono">{held.customerPhone}</div>
                  )}
                  <div className="text-xs text-emerald-700 font-medium mt-1">{held.note}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResumeBill(held)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Resume</span>
                  </button>
                  <button
                    onClick={async () => {
                      await db.heldBills.delete(held.id);
                      await loadData();
                      onRefreshStats();
                    }}
                    className="text-red-400 hover:text-red-600 p-1.5"
                    title="Discard held bill"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </dialog>
    </div>
  );
};
