import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Plus,
  Search,
  DollarSign,
  Phone,
  FileText,
  CheckCircle2,
  X,
  CreditCard,
  Banknote,
  QrCode,
  ArrowDownRight,
  Receipt,
  Printer,
  Eye,
  Calendar,
  Filter,
  ArrowUpDown,
  ShoppingBag,
  ExternalLink,
  RefreshCw,
  Clock,
  Sparkles,
  Trash2,
  CloudUpload,
  LogOut,
} from 'lucide-react';
import { db } from '../db/db';
import { Customer, CustomerPayment, Invoice, StoreSettings } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  syncCustomerToCloud,
  syncCustomerPaymentToCloud,
  deleteCustomerFromCloud,
  deleteInvoiceFromCloud,
  syncAllBillingAndPaymentsToCloud,
} from '../firebase/firestoreService';
import { PrintReceipt } from './PrintReceipt';

interface CustomerKhataProps {
  settings: StoreSettings | null;
  onRefreshStats: () => void;
  onExit?: () => void;
}

const DEMO_CUSTOMER_IDS = ['cust-01', 'cust-02', 'cust-03', 'cust-04'];
const DEMO_CUSTOMER_NAMES = ['rajesh sharma', 'pooja verma', 'anil deshmukh', 'sunita patil'];
const DEMO_INVOICE_IDS = ['inv-demo-01', 'INV-2026-0001'];

export const CustomerKhata: React.FC<CustomerKhataProps> = ({ settings, onRefreshStats, onExit }) => {
  const symbol = settings?.currencySymbol || '₹';

  // Sub-tabs: 'customers' (Directory & Ledgers) vs 'all-bills' (All Store Bills Register)
  const [activeTab, setActiveTab] = useState<'customers' | 'all-bills'>('customers');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [onlyWithDue, setOnlyWithDue] = useState(false);

  // All Bills view filters
  const [billSearch, setBillSearch] = useState('');
  const [billModeFilter, setBillModeFilter] = useState<'all' | 'cash' | 'upi' | 'card' | 'credit'>('all');
  const [billDateFilter, setBillDateFilter] = useState<'all' | 'today' | '7days' | 'month'>('all');

  // Selected customer for viewing ledger statement
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // View / Reprint Modal State
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<Invoice | null>(null);
  const [printFormat, setPrintFormat] = useState<'thermal-80mm' | 'a4-tax-invoice'>('thermal-80mm');
  const invoiceModalRef = useRef<HTMLDialogElement>(null);

  // Add Customer Modal
  const [isAddCustModalOpen, setIsAddCustModalOpen] = useState(false);
  const [custForm, setCustForm] = useState<Partial<Customer>>({
    name: '',
    phone: '',
    email: '',
    address: '',
    doctorName: '',
  });

  // Receive Payment Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [targetCustForPay, setTargetCustForPay] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMode, setPayMode] = useState<'cash' | 'upi' | 'card'>('cash');
  const [payNotes, setPayNotes] = useState('');

  const addCustDialogRef = useRef<HTMLDialogElement>(null);
  const payDialogRef = useRef<HTMLDialogElement>(null);

  // Cloud Sync state
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudSyncToast, setCloudSyncToast] = useState<string | null>(null);

  const handleSyncAllToFirebase = async () => {
    setIsSyncingCloud(true);
    try {
      const res = await syncAllBillingAndPaymentsToCloud();
      if (res.success) {
        setCloudSyncToast(`✅ Synced ${res.invoicesCount} bills & ${res.paymentsCount} payments to Firebase Cloud!`);
      } else {
        setCloudSyncToast(`⚠️ Cloud notice: ${res.message}`);
      }
    } catch (err: any) {
      setCloudSyncToast(`❌ Sync failed: ${err?.message || 'Error syncing to Firebase'}`);
    } finally {
      setIsSyncingCloud(false);
      setTimeout(() => setCloudSyncToast(null), 5000);
    }
  };

  // Automatically purge demo customers & demo invoices
  const purgeDemoData = async () => {
    try {
      const allCusts = await db.customers.toArray();
      const demoCusts = allCusts.filter(
        (c) =>
          DEMO_CUSTOMER_IDS.includes(c.id) ||
          DEMO_CUSTOMER_NAMES.includes(c.name.trim().toLowerCase())
      );
      for (const dc of demoCusts) {
        await db.customers.delete(dc.id);
        deleteCustomerFromCloud(dc.id);
      }

      const allInvs = await db.invoices.toArray();
      const demoInvs = allInvs.filter(
        (i) =>
          DEMO_INVOICE_IDS.includes(i.id) ||
          DEMO_INVOICE_IDS.includes(i.invoiceNo) ||
          (i.customerId && DEMO_CUSTOMER_IDS.includes(i.customerId)) ||
          (i.customerName && DEMO_CUSTOMER_NAMES.includes(i.customerName.trim().toLowerCase()))
      );
      for (const di of demoInvs) {
        await db.invoices.delete(di.id);
        deleteInvoiceFromCloud(di.id);
      }
    } catch (err) {
      console.warn('Error purging demo data:', err);
    }
  };

  const loadData = async () => {
    const custs = await db.customers.toArray();
    const pmts = await db.customerPayments.toArray();
    const invs = await db.invoices.reverse().toArray(); // newest bills first
    setCustomers(custs);
    setPayments(pmts);
    setInvoices(invs);

    if (selectedCustomer) {
      const refreshed = custs.find((c) => c.id === selectedCustomer.id);
      setSelectedCustomer(refreshed || null);
    }
  };

  useEffect(() => {
    const init = async () => {
      await purgeDemoData();
      await loadData();
      onRefreshStats();
      // Ensure all stored billing and payment data are synchronized to Firebase Cloud
      syncAllBillingAndPaymentsToCloud().catch((err) => {
        console.warn('Background Firebase billing sync:', err);
      });
    };
    init();
  }, []);

  // Delete a customer
  const handleDeleteCustomer = async (cust: Customer) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete customer "${cust.name}"?\nThis will permanently remove their record from Customer Directory & Khata.`
    );
    if (!confirmed) return;

    try {
      await db.customers.delete(cust.id);
      deleteCustomerFromCloud(cust.id);

      if (selectedCustomer?.id === cust.id) {
        setSelectedCustomer(null);
      }

      await loadData();
      onRefreshStats();
    } catch (err) {
      console.error('Failed to delete customer:', err);
      alert('Failed to delete customer.');
    }
  };

  // Delete an invoice
  const handleDeleteInvoice = async (inv: Invoice) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete Invoice ${inv.invoiceNo} (${formatCurrency(inv.grandTotal, symbol)})?\nThis will permanently remove this bill from records.`
    );
    if (!confirmed) return;

    try {
      await db.invoices.delete(inv.id);
      deleteInvoiceFromCloud(inv.id);

      await loadData();
      onRefreshStats();
    } catch (err) {
      console.error('Failed to delete invoice:', err);
      alert('Failed to delete invoice.');
    }
  };

  // Helper to get all bills for a specific customer
  const getCustomerInvoices = (c: Customer) => {
    return invoices.filter((i) => {
      if (i.customerId && i.customerId === c.id) return true;
      if (c.phone && c.phone !== 'N/A' && c.phone !== '-' && i.customerPhone === c.phone) return true;
      if (c.name && i.customerName && i.customerName.trim().toLowerCase() === c.name.trim().toLowerCase()) return true;
      return false;
    });
  };

  // Filter customers for directory view
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.address && c.address.toLowerCase().includes(search.toLowerCase()));

    const matchesDue = !onlyWithDue || c.outstandingBalance > 0;
    return matchesSearch && matchesDue;
  });

  // Dates for bill filtering
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7);

  // Filter all bills register
  const filteredAllBills = invoices.filter((inv) => {
    if (billModeFilter !== 'all' && inv.paymentMode !== billModeFilter) {
      return false;
    }

    if (billDateFilter === 'today') {
      if (inv.date !== todayStr) return false;
    } else if (billDateFilter === '7days') {
      const invDate = new Date(inv.date);
      const diffDays = (now.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 7) return false;
    } else if (billDateFilter === 'month') {
      if (!inv.date.startsWith(currentMonthStr)) return false;
    }

    if (billSearch.trim()) {
      const q = billSearch.toLowerCase().trim();
      const inInvoiceNo = inv.invoiceNo.toLowerCase().includes(q);
      const inCustomer = (inv.customerName || '').toLowerCase().includes(q);
      const inPhone = (inv.customerPhone || '').includes(q);
      const inDoctor = (inv.doctorName || '').toLowerCase().includes(q);
      const inItems = inv.items?.some(
        (item) =>
          item.medicineName.toLowerCase().includes(q) ||
          item.genericName?.toLowerCase().includes(q) ||
          item.batchNumber?.toLowerCase().includes(q)
      );
      return inInvoiceNo || inCustomer || inPhone || inDoctor || inItems;
    }

    return true;
  });

  // Financial summary metrics
  const totalOutstanding = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);
  const totalBillsAmount = invoices.reduce((sum, i) => sum + i.grandTotal, 0);
  const totalPaidAmount = invoices.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
  const totalCreditAmount = invoices.reduce((sum, i) => sum + (i.creditAmount || 0), 0);

  // Save new customer
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.name) {
      alert('Please enter Customer Name.');
      return;
    }

    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: custForm.name.trim(),
      phone: custForm.phone?.trim() || 'N/A',
      email: custForm.email?.trim(),
      address: custForm.address?.trim(),
      doctorName: custForm.doctorName?.trim(),
      outstandingBalance: 0,
      totalPurchases: 0,
      createdAt: new Date().toISOString(),
    };

    await db.customers.put(newCust);
    syncCustomerToCloud(newCust);
    setIsAddCustModalOpen(false);
    addCustDialogRef.current?.close();
    setCustForm({ name: '', phone: '', email: '', address: '', doctorName: '' });
    await loadData();
    onRefreshStats();
  };

  // Open Receive Payment Modal
  const openPaymentModal = (c: Customer) => {
    setTargetCustForPay(c);
    setPayAmount(c.outstandingBalance.toString());
    setPayNotes(`Khata settlement on ${new Date().toLocaleDateString()}`);
    setIsPayModalOpen(true);
    payDialogRef.current?.showModal();
  };

  const closePaymentModal = () => {
    setIsPayModalOpen(false);
    payDialogRef.current?.close();
  };

  // Record Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCustForPay) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    const paymentRecord: CustomerPayment = {
      id: `pay-${Date.now()}`,
      customerId: targetCustForPay.id,
      customerName: targetCustForPay.name,
      date: new Date().toISOString().split('T')[0],
      amount,
      paymentMode: payMode,
      notes: payNotes,
    };

    await db.transaction('rw', [db.customers, db.customerPayments], async () => {
      await db.customerPayments.put(paymentRecord);
      const newBalance = Math.max(0, targetCustForPay.outstandingBalance - amount);
      await db.customers.update(targetCustForPay.id, {
        outstandingBalance: newBalance,
      });
    });

    syncCustomerPaymentToCloud(paymentRecord);
    db.customers.get(targetCustForPay.id).then((c) => {
      if (c) syncCustomerToCloud(c);
    });

    closePaymentModal();
    await loadData();
    onRefreshStats();
    alert(`Payment of ${formatCurrency(amount, symbol)} recorded for ${targetCustForPay.name}!`);
  };

  // Open Bill View / Reprint Modal
  const handleOpenBillModal = (inv: Invoice, format: 'thermal-80mm' | 'a4-tax-invoice' = 'thermal-80mm') => {
    setSelectedInvoiceForModal(inv);
    setPrintFormat(format);
    invoiceModalRef.current?.showModal();
  };

  const handleCloseBillModal = () => {
    invoiceModalRef.current?.close();
    setSelectedInvoiceForModal(null);
  };

  // Invoices & payments for selected customer
  const customerInvoices = selectedCustomer ? getCustomerInvoices(selectedCustomer) : [];
  const customerPaymentsList = selectedCustomer
    ? payments.filter((p) => p.customerId === selectedCustomer.id)
    : [];

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Header Banner with Sub-tab Switcher */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Customer Directory, Khata & All Bills Register
            </h2>
            <p className="text-xs text-slate-500">
              Manage real customer accounts, track credit balances (Khata), and access all store bills.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span className="text-emerald-800 font-semibold">Total Stored Bills: </span>
              <strong className="text-emerald-950 font-mono">{invoices.length} Bills</strong>
            </div>

            <div className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-xs flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-red-600" />
              <span className="text-red-700 font-semibold">Total Khata Due: </span>
              <strong className="text-red-800 text-sm font-mono">{formatCurrency(totalOutstanding, symbol)}</strong>
            </div>

            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                title="Exit Khata"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>Exit</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSyncAllToFirebase}
              disabled={isSyncingCloud}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              title="Sync all billing and payment records directly to Firebase Cloud"
            >
              <CloudUpload className={`w-4 h-4 text-blue-600 ${isSyncingCloud ? 'animate-bounce' : ''}`} />
              <span>{isSyncingCloud ? 'Syncing...' : 'Sync to Firebase'}</span>
            </button>

            <button
              onClick={() => {
                setIsAddCustModalOpen(true);
                addCustDialogRef.current?.showModal();
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Customer</span>
            </button>

            <button
              onClick={async () => {
                await purgeDemoData();
                await loadData();
                onRefreshStats();
              }}
              title="Refresh local data"
              className="p-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sync Toast Notification */}
        {cloudSyncToast && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{cloudSyncToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setCloudSyncToast(null)}
              className="text-blue-600 hover:text-blue-950 p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* View Switcher Tabs */}
        <div className="flex border-b border-slate-200 gap-1 pt-1">
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'customers'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Customer Directory & Khata Ledger</span>
            <span className="px-1.5 py-0.5 text-[10px] bg-slate-200 text-slate-700 rounded-full font-mono">
              {customers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all-bills')}
            className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'all-bills'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>All Store Bills & Invoices Register</span>
            <span className="px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 rounded-full font-mono font-bold">
              {invoices.length} Bills
            </span>
          </button>
        </div>
      </div>

      {/* ================= VIEW 1: CUSTOMERS & KHATA LEDGER ================= */}
      {activeTab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Customer List (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            {/* Search & Toggle Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex flex-col sm:flex-row justify-between items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, phone, address..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyWithDue}
                  onChange={(e) => setOnlyWithDue(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Show Only Customers with Due ({customers.filter((c) => c.outstandingBalance > 0).length})</span>
              </label>
            </div>

            {/* Customer Cards / Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Customer / Patient</th>
                    <th className="py-2.5 px-2">Phone</th>
                    <th className="py-2.5 px-2 text-center">Bills Stored</th>
                    <th className="py-2.5 px-2 text-right">Total Purchases</th>
                    <th className="py-2.5 px-2 text-right">Khata Due Balance</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold">No customers registered yet.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Customers are automatically added here when creating bills in POS or by clicking "+ Add Customer".
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((cust) => {
                      const isSelected = selectedCustomer?.id === cust.id;
                      const hasDue = cust.outstandingBalance > 0;
                      const custBills = getCustomerInvoices(cust);

                      return (
                        <tr
                          key={cust.id}
                          onClick={() => setSelectedCustomer(cust)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-emerald-50/80 font-medium' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{cust.name}</div>
                            {cust.address && <div className="text-[10px] text-slate-400 truncate max-w-xs">{cust.address}</div>}
                          </td>

                          <td className="py-2.5 px-2 font-mono text-slate-700">{cust.phone}</td>

                          <td className="py-2.5 px-2 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                custBills.length > 0
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {custBills.length} {custBills.length === 1 ? 'bill' : 'bills'}
                            </span>
                          </td>

                          <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                            {formatCurrency(cust.totalPurchases, symbol)}
                          </td>

                          <td className="py-2.5 px-2 text-right">
                            <span
                              className={`font-mono font-black text-xs px-2 py-0.5 rounded ${
                                hasDue ? 'bg-red-100 text-red-700 border border-red-300' : 'text-slate-500'
                              }`}
                            >
                              {formatCurrency(cust.outstandingBalance, symbol)}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end items-center gap-1.5">
                              {hasDue && (
                                <button
                                  type="button"
                                  onClick={() => openPaymentModal(cust)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-xs transition-colors"
                                >
                                  Receive Pay
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedCustomer(cust)}
                                className={`px-2 py-1 border rounded text-[11px] font-semibold transition-colors ${
                                  isSelected
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                Ledger
                              </button>
                              <button
                                type="button"
                                title={`Delete ${cust.name}`}
                                onClick={() => handleDeleteCustomer(cust)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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

          {/* Selected Customer Statement & History (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {selectedCustomer ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4 sticky top-4">
                <div className="border-b border-slate-200 pb-3 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{selectedCustomer.name}</h3>
                      <button
                        type="button"
                        title="Delete Customer Profile"
                        onClick={() => handleDeleteCustomer(selectedCustomer)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{selectedCustomer.phone}</span>
                    </div>
                    {selectedCustomer.doctorName && (
                      <div className="text-xs text-emerald-800 mt-1 font-medium">
                        Doctor: {selectedCustomer.doctorName}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Current Outstanding</div>
                    <div className="text-xl font-black font-mono text-red-600 mt-0.5">
                      {formatCurrency(selectedCustomer.outstandingBalance, symbol)}
                    </div>
                    {selectedCustomer.outstandingBalance > 0 && (
                      <button
                        onClick={() => openPaymentModal(selectedCustomer)}
                        className="mt-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm"
                      >
                        Receive Payment
                      </button>
                    )}
                  </div>
                </div>

                {/* Purchase Bills by this customer */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                      Past Bills & Invoices ({customerInvoices.length})
                    </h4>
                    {customerInvoices.length > 0 && (
                      <span className="text-[10px] text-slate-400">Click Eye to view details</span>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs border border-slate-200 rounded-lg">
                    {customerInvoices.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs space-y-1">
                        <ShoppingBag className="w-6 h-6 mx-auto text-slate-300" />
                        <p>No bills found for this customer record.</p>
                      </div>
                    ) : (
                      customerInvoices.map((inv) => (
                        <div key={inv.id} className="p-3 hover:bg-slate-50 transition-colors space-y-1.5">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{inv.invoiceNo}</span>
                                <span
                                  className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                                    inv.paymentMode === 'credit'
                                      ? 'bg-red-50 text-red-700 border border-red-200'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  {inv.paymentMode}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {formatDate(inv.date)} {inv.time} &bull; {inv.items.length} items
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="font-mono font-bold text-slate-900 text-sm">
                                {formatCurrency(inv.grandTotal, symbol)}
                              </div>
                            </div>
                          </div>

                          {/* Preview of medicines in bill */}
                          <div className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100 line-clamp-2">
                            {inv.items.map((i) => `${i.medicineName} (${i.qty})`).join(', ')}
                          </div>

                          {/* Quick action buttons */}
                          <div className="flex justify-end items-center gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleOpenBillModal(inv, 'thermal-80mm')}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded text-[10px] font-bold inline-flex items-center gap-1 border border-slate-200"
                            >
                              <Eye className="w-3 h-3 text-emerald-600" />
                              <span>View Bill</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenBillModal(inv, 'a4-tax-invoice')}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold inline-flex items-center gap-1 border border-slate-200"
                            >
                              <Printer className="w-3 h-3 text-slate-600" />
                              <span>A4</span>
                            </button>
                            <button
                              type="button"
                              title="Delete Invoice"
                              onClick={() => handleDeleteInvoice(inv)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Payments History by this customer */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                    Payment Collections Received ({customerPaymentsList.length})
                  </h4>

                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs border border-slate-200 rounded-lg">
                    {customerPaymentsList.length === 0 ? (
                      <p className="p-4 text-center text-slate-400 text-xs">No direct payments recorded yet.</p>
                    ) : (
                      customerPaymentsList.map((p) => (
                        <div key={p.id} className="p-2.5 hover:bg-slate-50 flex justify-between items-center">
                          <div>
                            <div className="font-bold text-emerald-700">{formatDate(p.date)}</div>
                            <div className="text-[10px] text-slate-500">{p.notes || 'Khata settlement'}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-emerald-600">
                              - {formatCurrency(p.amount, symbol)}
                            </div>
                            <span className="text-[9px] uppercase font-bold text-slate-500">{p.paymentMode}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">
                  Select a customer from the left to view their detailed Khata ledger, full bill list, and payment history.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= VIEW 2: ALL STORE BILLS REGISTER ================= */}
      {activeTab === 'all-bills' && (
        <div className="space-y-4">
          {/* Summary Metric KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Bills Generated</div>
                <div className="text-lg font-black font-mono text-slate-900">{invoices.length}</div>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Total Sales Revenue</div>
                <div className="text-lg font-black font-mono text-blue-900">
                  {formatCurrency(totalBillsAmount, symbol)}
                </div>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Total Paid (Collected)</div>
                <div className="text-lg font-black font-mono text-teal-900">
                  {formatCurrency(totalPaidAmount, symbol)}
                </div>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-600 font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Khata (Credit) Outstanding</div>
                <div className="text-lg font-black font-mono text-red-700">
                  {formatCurrency(totalCreditAmount, symbol)}
                </div>
              </div>
            </div>
          </div>

          {/* Search, Date Filter & Payment Filter Toolbar */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3.5 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={billSearch}
                onChange={(e) => setBillSearch(e.target.value)}
                placeholder="Search Bill #, Patient, Phone, Doctor, Medicine..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
              />
              {billSearch && (
                <button
                  type="button"
                  onClick={() => setBillSearch('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Payment Mode Pills */}
              <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-bold text-slate-600">
                {(['all', 'cash', 'upi', 'card', 'credit'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setBillModeFilter(mode)}
                    className={`px-2.5 py-1 rounded capitalize transition-all ${
                      billModeFilter === mode
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Date Filter Pills */}
              <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-bold text-slate-600">
                {(
                  [
                    { id: 'all', label: 'All Time' },
                    { id: 'today', label: 'Today' },
                    { id: '7days', label: 'Last 7 Days' },
                    { id: 'month', label: 'This Month' },
                  ] as const
                ).map((df) => (
                  <button
                    key={df.id}
                    type="button"
                    onClick={() => setBillDateFilter(df.id)}
                    className={`px-2 py-1 rounded transition-all ${
                      billDateFilter === df.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {df.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table of All Stored Bills */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700">
                Showing <strong className="text-slate-900">{filteredAllBills.length}</strong> of{' '}
                <strong className="text-slate-900">{invoices.length}</strong> total bills stored in database
              </span>
              {(billSearch || billModeFilter !== 'all' || billDateFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setBillSearch('');
                    setBillModeFilter('all');
                    setBillDateFilter('all');
                  }}
                  className="text-emerald-700 hover:underline font-bold text-[11px]"
                >
                  Reset Filters
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-2">Date & Time</th>
                    <th className="py-2.5 px-3">Customer / Patient</th>
                    <th className="py-2.5 px-2">Prescribing Doctor</th>
                    <th className="py-2.5 px-3">Medicines Sold</th>
                    <th className="py-2.5 px-2 text-center">Payment Mode</th>
                    <th className="py-2.5 px-3 text-right">Grand Total</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAllBills.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400">
                        <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold">No bills found matching current search/filter criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAllBills.map((inv) => {
                      const isCredit = inv.paymentMode === 'credit';

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                            {inv.invoiceNo}
                          </td>

                          <td className="py-2.5 px-2 text-slate-600 whitespace-nowrap">
                            <div>{formatDate(inv.date)}</div>
                            <div className="text-[10px] text-slate-400">{inv.time}</div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{inv.customerName || 'Walk-in Customer'}</div>
                            {inv.customerPhone && inv.customerPhone !== 'N/A' && inv.customerPhone !== '-' && (
                              <div className="text-[10px] font-mono text-slate-500">{inv.customerPhone}</div>
                            )}
                          </td>

                          <td className="py-2.5 px-2 text-slate-700">
                            {inv.doctorName ? (
                              <div>
                                <span className="font-semibold text-slate-800">{inv.doctorName}</span>
                                {inv.doctorRegNo && (
                                  <div className="text-[10px] text-slate-400">Reg: {inv.doctorRegNo}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Self / OTC</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="text-slate-700 max-w-xs line-clamp-1">
                              {inv.items?.map((item) => `${item.medicineName} (x${item.qty})`).join(', ')}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {inv.items?.length || 0} line items &bull;{' '}
                              {inv.items?.reduce((s, i) => s + (i.qty || 0), 0) || 0} units
                            </div>
                          </td>

                          <td className="py-2.5 px-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                isCredit
                                  ? 'bg-red-100 text-red-800 border border-red-200'
                                  : inv.paymentMode === 'upi'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : inv.paymentMode === 'card'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {inv.paymentMode}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                            {formatCurrency(inv.grandTotal, symbol)}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <div className="flex justify-end items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenBillModal(inv, 'thermal-80mm')}
                                className="px-2 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded text-[11px] font-bold inline-flex items-center gap-1 border border-slate-200 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                <span>View</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenBillModal(inv, 'a4-tax-invoice')}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold inline-flex items-center gap-1 border border-slate-200 transition-colors"
                              >
                                <Printer className="w-3.5 h-3.5 text-slate-600" />
                                <span>A4</span>
                              </button>

                              <button
                                type="button"
                                title={`Delete ${inv.invoiceNo}`}
                                onClick={() => handleDeleteInvoice(inv)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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
        </div>
      )}

      {/* ================= INVOICE DETAIL & REPRINT MODAL ================= */}
      <dialog
        ref={invoiceModalRef}
        aria-labelledby="invoice-modal-title"
        closedby="any"
        className="rounded-xl sm:rounded-2xl p-0 backdrop:bg-slate-900/60 shadow-2xl max-w-4xl w-[96vw] sm:w-full text-slate-900 overflow-hidden border border-slate-200 m-auto"
      >
        <div className="bg-slate-900 text-white p-3 sm:px-6 sm:py-3.5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 print:hidden">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div className="min-w-0">
              <h2 id="invoice-modal-title" className="text-sm sm:text-base font-bold flex items-center gap-2 truncate">
                <Receipt className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">Invoice: {selectedInvoiceForModal?.invoiceNo}</span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                {selectedInvoiceForModal?.customerName || 'Cash Customer'} &bull; {selectedInvoiceForModal?.date} {selectedInvoiceForModal?.time}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCloseBillModal}
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
              onClick={handleCloseBillModal}
              className="hidden sm:flex p-1.5 text-slate-400 hover:text-white rounded-lg shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-2 sm:p-6 bg-slate-100 max-h-[80vh] overflow-y-auto overflow-x-auto">
          {selectedInvoiceForModal && (
            <PrintReceipt invoice={selectedInvoiceForModal} settings={settings} format={printFormat} />
          )}
        </div>
      </dialog>

      {/* ================= ADD CUSTOMER DIALOG ================= */}
      <dialog
        ref={addCustDialogRef}
        aria-labelledby="add-cust-title"
        closedby="any"
        className="rounded-2xl p-0 backdrop:bg-slate-900/60 shadow-2xl max-w-md w-full text-slate-900 overflow-hidden border border-slate-200"
      >
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <h2 id="add-cust-title" className="text-base font-bold">
            Add New Customer / Patient
          </h2>
          <button
            onClick={() => {
              setIsAddCustModalOpen(false);
              addCustDialogRef.current?.close();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Patient Name *</label>
            <input
              type="text"
              required
              autoFocus
              value={custForm.name || ''}
              onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
              placeholder="e.g. Ramesh Kulkarni"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Mobile / Phone Number</label>
            <input
              type="tel"
              value={custForm.phone || ''}
              onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
              placeholder="10 digit mobile"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Address / Society</label>
            <input
              type="text"
              value={custForm.address || ''}
              onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
              placeholder="Flat / Street address"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Family Doctor</label>
            <input
              type="text"
              value={custForm.doctorName || ''}
              onChange={(e) => setCustForm({ ...custForm, doctorName: e.target.value })}
              placeholder="e.g. Dr. V. K. Mehta"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="bg-slate-100 -mx-6 -mb-6 p-4 flex justify-end space-x-2 border-t border-slate-200 mt-6">
            <button
              type="button"
              onClick={() => {
                setIsAddCustModalOpen(false);
                addCustDialogRef.current?.close();
              }}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md"
            >
              Save Customer
            </button>
          </div>
        </form>
      </dialog>

      {/* ================= RECEIVE PAYMENT DIALOG ================= */}
      <dialog
        ref={payDialogRef}
        aria-labelledby="pay-dialog-title"
        closedby="any"
        className="rounded-2xl p-0 backdrop:bg-slate-900/60 shadow-2xl max-w-md w-full text-slate-900 overflow-hidden border border-slate-200"
      >
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 id="pay-dialog-title" className="text-base font-bold">
              Receive Khata Payment
            </h2>
            <p className="text-xs text-slate-400">{targetCustForPay?.name}</p>
          </div>
          <button onClick={closePaymentModal} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex justify-between items-center text-xs">
            <span className="text-red-700 font-semibold">Total Due Balance:</span>
            <span className="font-mono font-black text-red-800 text-base">
              {formatCurrency(targetCustForPay?.outstandingBalance || 0, symbol)}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Payment Amount Received *</label>
            <input
              type="number"
              step="0.01"
              required
              autoFocus
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full text-xl font-bold font-mono px-3 py-2 border border-slate-300 rounded-lg text-emerald-700 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Payment Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'cash', label: 'Cash', icon: Banknote },
                { id: 'upi', label: 'UPI / QR', icon: QrCode },
                { id: 'card', label: 'Card', icon: CreditCard },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = payMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPayMode(m.id as 'cash' | 'upi' | 'card')}
                    className={`p-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Receipt Remarks</label>
            <input
              type="text"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="e.g. Part payment via UPI"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="bg-slate-100 -mx-6 -mb-6 p-4 flex justify-end space-x-2 border-t border-slate-200 mt-6">
            <button
              type="button"
              onClick={closePaymentModal}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md"
            >
              Record Payment
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
};
