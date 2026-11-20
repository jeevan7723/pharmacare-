import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Calendar,
  Printer,
  Eye,
  Download,
  PlusCircle,
  CreditCard,
  Banknote,
  QrCode,
  FileText,
  X,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  Building2,
  RefreshCw,
  ShoppingBag,
  Cpu,
  Sparkles,
  Pill,
} from 'lucide-react';
import { db } from '../db/db';
import { Invoice, StoreSettings, Workspace } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { PrintReceipt } from './PrintReceipt';
import { useLanguage } from '../context/LanguageContext';
import { syncInvoiceToCloud } from '../firebase/firestoreService';

interface GeneratedBillsProps {
  settings: StoreSettings | null;
  currentWorkspace?: Workspace | null;
  onNewBill: () => void;
}

export const GeneratedBills: React.FC<GeneratedBillsProps> = ({
  settings,
  currentWorkspace,
  onNewBill,
}) => {
  const { t, language } = useLanguage();
  const targetWsId = currentWorkspace?.id || 'ws_healthplus';
  const currencySymbol = currentWorkspace?.settings?.currencySymbol || settings?.currencySymbol || '₹';

  const [bills, setBills] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | 'month'>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');

  // Selected Bill for Details Modal
  const [viewingBill, setViewingBill] = useState<Invoice | null>(null);

  // Selected Bill for Reprinting
  const [reprintBill, setReprintBill] = useState<Invoice | null>(null);
  const [printFormat, setPrintFormat] = useState<'thermal-80mm' | 'a4-tax-invoice'>('thermal-80mm');
  const printDialogRef = useRef<HTMLDialogElement>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Load bills from local Dexie database
  const loadBills = async () => {
    try {
      setIsLoading(true);
      const allInvoices = await db.invoices.reverse().toArray();
      const filtered = allInvoices.filter(
        (inv) => (inv.workspaceId || 'ws_healthplus') === targetWsId
      );
      setBills(filtered);
    } catch (err) {
      console.error('Error loading generated bills:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
  }, [targetWsId]);

  // Sync all bills for this company to Cloud Firestore `generated_bills`
  const handleForceCloudSync = async () => {
    try {
      setIsSyncing(true);
      setSyncStatusMsg('Syncing to Cloud Firestore collection "generated_bills"...');
      for (const bill of bills) {
        await syncInvoiceToCloud(bill);
      }
      setSyncStatusMsg(`Successfully backed up ${bills.length} bills in Firestore "generated_bills"!`);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } catch (err: any) {
      setSyncStatusMsg(`Sync notice: ${err?.message || 'Done'}`);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Filtered & Sorted Bills
  const filteredBills = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonthStr = todayStr.substring(0, 7);

    return bills.filter((b) => {
      // Search matching (Bill No, Customer Name, Customer Phone, Doctor Name)
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesNo = b.invoiceNo.toLowerCase().includes(q);
        const matchesCust = b.customerName.toLowerCase().includes(q);
        const matchesPhone = b.customerPhone.includes(q);
        const matchesDoc = b.doctorName?.toLowerCase().includes(q);
        const matchesItem = b.items.some((it) => it.medicineName.toLowerCase().includes(q));
        if (!matchesNo && !matchesCust && !matchesPhone && !matchesDoc && !matchesItem) {
          return false;
        }
      }

      // Date filtering
      if (dateFilter === 'today' && b.date !== todayStr) return false;
      if (dateFilter === '7days') {
        const bDate = new Date(b.date);
        const diffDays = (now.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) return false;
      }
      if (dateFilter === 'month' && !b.date.startsWith(currentMonthStr)) return false;

      // Payment filter
      if (paymentFilter !== 'all' && b.paymentMode !== paymentFilter) return false;

      // Status filter
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;

      return true;
    }).sort((a, b) => {
      if (sortOrder === 'newest') return b.id.localeCompare(a.id);
      if (sortOrder === 'oldest') return a.id.localeCompare(b.id);
      if (sortOrder === 'highest') return b.grandTotal - a.grandTotal;
      if (sortOrder === 'lowest') return a.grandTotal - b.grandTotal;
      return 0;
    });
  }, [bills, searchQuery, dateFilter, paymentFilter, statusFilter, sortOrder]);

  // Financial aggregates for currently filtered bills
  const totalRevenue = useMemo(
    () => filteredBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0),
    [filteredBills]
  );
  const totalTaxable = useMemo(
    () => filteredBills.reduce((sum, b) => sum + (b.taxableAmount || 0), 0),
    [filteredBills]
  );
  const totalGst = useMemo(
    () => filteredBills.reduce((sum, b) => sum + (b.totalGst || 0), 0),
    [filteredBills]
  );
  const totalDiscount = useMemo(
    () => filteredBills.reduce((sum, b) => sum + (b.totalDiscount || 0), 0),
    [filteredBills]
  );

  // Payment Breakdown
  const cashSum = useMemo(
    () => filteredBills.filter((b) => b.paymentMode === 'cash').reduce((s, b) => s + b.paidAmount, 0),
    [filteredBills]
  );
  const upiSum = useMemo(
    () => filteredBills.filter((b) => b.paymentMode === 'upi').reduce((s, b) => s + b.paidAmount, 0),
    [filteredBills]
  );
  const cardSum = useMemo(
    () => filteredBills.filter((b) => b.paymentMode === 'card').reduce((s, b) => s + b.paidAmount, 0),
    [filteredBills]
  );
  const creditSum = useMemo(
    () => filteredBills.reduce((s, b) => s + (b.creditAmount || 0), 0),
    [filteredBills]
  );

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredBills.length === 0) {
      alert('No generated bills to export.');
      return;
    }

    const headers = [
      'Bill No',
      'Date',
      'Time',
      'Customer Name',
      'Phone',
      'Doctor/Prescriber',
      'Items Count',
      'Subtotal',
      'Discount',
      'Taxable',
      'GST',
      'Grand Total',
      'Payment Mode',
      'Paid Amount',
      'Credit Amount',
      'Status',
    ];

    const rows = filteredBills.map((b) => [
      b.invoiceNo,
      b.date,
      b.time,
      `"${b.customerName.replace(/"/g, '""')}"`,
      b.customerPhone,
      `"${(b.doctorName || '').replace(/"/g, '""')}"`,
      b.items.length,
      b.subtotal.toFixed(2),
      b.totalDiscount.toFixed(2),
      b.taxableAmount.toFixed(2),
      b.totalGst.toFixed(2),
      b.grandTotal.toFixed(2),
      b.paymentMode,
      b.paidAmount.toFixed(2),
      b.creditAmount.toFixed(2),
      b.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Generated_Bills_${targetWsId}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openReprint = (bill: Invoice) => {
    setReprintBill(bill);
    printDialogRef.current?.showModal();
  };

  const executePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  {language === 'mr' ? 'तयार केलेली सर्व बिले (नोंदवही)' : 'Generated Bills Register'}
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {currentWorkspace?.name || 'Active Company'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'mr'
                  ? 'सर्व विक्री बिले येथे स्वतंत्र भागात सुरक्षित साठवली आहेत. तपशील पहा आणि बिल पुन्हा प्रिंट करा.'
                  : 'Dedicated section storing all issued retail sales bills, item breakdowns, payments, and reprint options.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Cloud Firestore Sync Status Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Firestore: <code>generated_bills</code></span>
          </div>

          <button
            onClick={handleForceCloudSync}
            disabled={isSyncing}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
            title="Backup all bills to Firebase Firestore collection 'generated_bills'"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{language === 'mr' ? 'CSV डाऊनलोड' : 'Export CSV'}</span>
          </button>

          <button
            onClick={onNewBill}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/30 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{language === 'mr' ? 'नवीन बिल तयार करा (F2)' : 'New Bill POS (F2)'}</span>
          </button>
        </div>
      </div>

      {syncStatusMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncStatusMsg}</span>
        </div>
      )}

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>{language === 'mr' ? 'एकूण बिले' : 'Total Bills'}</span>
            <Receipt className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1.5 font-mono">
            {filteredBills.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {language === 'mr' ? 'यादीतील तयार बिले' : 'In current filter'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>{language === 'mr' ? 'एकूण विक्री मूल्य' : 'Total Value'}</span>
            <span className="text-xs font-black text-emerald-600 font-mono">{currencySymbol}</span>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1.5 font-mono">
            {formatCurrency(totalRevenue, currencySymbol)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {language === 'mr' ? `करपात्र: ${formatCurrency(totalTaxable, currencySymbol)}` : `Taxable: ${formatCurrency(totalTaxable, currencySymbol)}`}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>{language === 'mr' ? 'रोख (Cash)' : 'Cash Collected'}</span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1.5 font-mono">
            {formatCurrency(cashSum, currencySymbol)}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
            {filteredBills.filter((b) => b.paymentMode === 'cash').length} bills
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>{language === 'mr' ? 'ऑनलाईन (UPI / Card)' : 'Digital (UPI/Card)'}</span>
            <QrCode className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1.5 font-mono">
            {formatCurrency(upiSum + cardSum, currencySymbol)}
          </div>
          <div className="text-[11px] text-blue-700 font-semibold mt-1">
            UPI: {formatCurrency(upiSum, currencySymbol)} | Card: {formatCurrency(cardSum, currencySymbol)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>{language === 'mr' ? 'उधारी (Khata Due)' : 'Khata Credit'}</span>
            <CreditCard className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-700 mt-1.5 font-mono">
            {formatCurrency(creditSum, currencySymbol)}
          </div>
          <div className="text-[11px] text-amber-800 font-semibold mt-1">
            {filteredBills.filter((b) => b.creditAmount > 0).length} bills on credit
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === 'mr'
                  ? 'बिल क्र., ग्राहकाचे नाव, फोन, किंवा औषधाचे नाव शोधा...'
                  : 'Search by Bill No (e.g. INV-2026-0001), Customer Name, Phone, or Item...'
              }
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Date Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto">
            {(['all', 'today', '7days', 'month'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setDateFilter(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === mode
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode === 'all'
                  ? language === 'mr' ? 'सर्व काळ' : 'All Time'
                  : mode === 'today'
                  ? language === 'mr' ? 'आज' : 'Today'
                  : mode === '7days'
                  ? language === 'mr' ? 'मागील ७ दिवस' : 'Last 7 Days'
                  : language === 'mr' ? 'चालू महिना' : 'This Month'}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filters (Payment Mode, Status, Sort) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span className="font-semibold">{language === 'mr' ? 'पेमेंट प्रकार:' : 'Payment:'}</span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">All Modes</option>
                <option value="cash">Cash (रोख)</option>
                <option value="upi">UPI (फोनपे / गुगलपे)</option>
                <option value="card">Card (कार्ड)</option>
                <option value="credit">Khata (उधारी)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="font-semibold">{language === 'mr' ? 'स्थिती:' : 'Status:'}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid (पूर्ण भरले)</option>
                <option value="credit">Credit (उधारी)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="font-semibold">{language === 'mr' ? 'क्रम:' : 'Sort:'}</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="newest">Newest First (नवीन आधी)</option>
              <option value="oldest">Oldest First (जुने आधी)</option>
              <option value="highest">Highest Amount (मोठी रक्कम)</option>
              <option value="lowest">Lowest Amount (कमी रक्कम)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Generated Bills Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold">Loading generated bills...</p>
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {language === 'mr' ? 'कोणतेही बिल आढळले नाही' : 'No Generated Bills Found'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery || dateFilter !== 'all' || paymentFilter !== 'all'
                  ? 'No bills match your current search and filter criteria. Try resetting filters.'
                  : 'No bills have been generated for this company yet. Click "New Bill POS" to create your first bill.'}
              </p>
            </div>
            <button
              onClick={onNewBill}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{language === 'mr' ? 'पहिले बिल बनवा' : 'Create First Bill'}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Bill No & Date</th>
                  <th className="py-3 px-4">Customer / Patient</th>
                  <th className="py-3 px-4">Items / Products</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4 text-right">Taxable</th>
                  <th className="py-3 px-4 text-right">GST</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBills.map((bill) => {
                  const isCredit = bill.status === 'credit' || (bill.creditAmount && bill.creditAmount > 0);
                  const itemCount = bill.items.length;
                  const itemSummary = bill.items.map((i) => i.medicineName).slice(0, 2).join(', ') +
                    (itemCount > 2 ? ` +${itemCount - 2} more` : '');

                  return (
                    <tr
                      key={bill.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setViewingBill(bill)}
                    >
                      {/* Bill No & Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-black text-slate-900 group-hover:text-emerald-700 flex items-center gap-1.5">
                          <span>{bill.invoiceNo}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{bill.date}</span>
                          <span className="text-slate-300">&bull;</span>
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{bill.time}</span>
                        </div>
                      </td>

                      {/* Customer / Patient */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{bill.customerName}</div>
                        {bill.customerPhone && (
                          <div className="text-[11px] text-slate-500">{bill.customerPhone}</div>
                        )}
                        {bill.doctorName && (
                          <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                            Dr. {bill.doctorName}
                          </div>
                        )}
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        <div className="font-bold text-slate-800">
                          {itemCount} {itemCount === 1 ? 'item' : 'items'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate" title={bill.items.map((i) => i.medicineName).join(', ')}>
                          {itemSummary}
                        </div>
                      </td>

                      {/* Payment Mode */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              bill.paymentMode === 'cash'
                                ? 'bg-emerald-100 text-emerald-800'
                                : bill.paymentMode === 'upi'
                                ? 'bg-blue-100 text-blue-800'
                                : bill.paymentMode === 'card'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {bill.paymentMode}
                          </span>
                          {isCredit && (
                            <span className="text-[10px] font-bold text-amber-700">
                              Khata Due: {formatCurrency(bill.creditAmount, currencySymbol)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Taxable */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                        {formatCurrency(bill.taxableAmount, currencySymbol)}
                      </td>

                      {/* GST */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                        {formatCurrency(bill.totalGst, currencySymbol)}
                      </td>

                      {/* Grand Total */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono font-black text-sm text-slate-900 group-hover:text-emerald-700">
                          {formatCurrency(bill.grandTotal, currencySymbol)}
                        </div>
                        {bill.totalDiscount > 0 && (
                          <div className="text-[10px] text-red-600">
                            - {formatCurrency(bill.totalDiscount, currencySymbol)} off
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewingBill(bill)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="View Full Bill Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openReprint(bill)}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Reprint Bill (Thermal or A4)"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Summary Bar */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 font-semibold gap-2">
          <div>
            Showing <strong className="text-slate-900">{filteredBills.length}</strong> of{' '}
            <strong className="text-slate-900">{bills.length}</strong> total generated bills
          </div>
          <div className="flex items-center gap-4">
            <span>
              Total Taxable: <strong className="text-slate-900 font-mono">{formatCurrency(totalTaxable, currencySymbol)}</strong>
            </span>
            <span>
              Total GST: <strong className="text-slate-900 font-mono">{formatCurrency(totalGst, currencySymbol)}</strong>
            </span>
            <span>
              Grand Sum: <strong className="text-emerald-700 font-mono text-sm font-black">{formatCurrency(totalRevenue, currencySymbol)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Bill Details Modal */}
      {viewingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">
                      {viewingBill.invoiceNo}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                      {viewingBill.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {viewingBill.date} at {viewingBill.time} &bull; Workspace: {viewingBill.workspaceId || 'Default'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openReprint(viewingBill)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Reprint</span>
                </button>
                <button
                  onClick={() => setViewingBill(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Customer & Prescriber Info */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Customer / Patient
                  </span>
                  <div className="text-sm font-black text-slate-900 mt-0.5">
                    {viewingBill.customerName}
                  </div>
                  <div className="text-slate-600">{viewingBill.customerPhone || 'No phone recorded'}</div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Doctor / Prescriber
                  </span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {viewingBill.doctorName ? `Dr. ${viewingBill.doctorName}` : 'Self / Over The Counter (OTC)'}
                  </div>
                  {viewingBill.doctorRegNo && (
                    <div className="text-slate-500 text-[11px]">Reg: {viewingBill.doctorRegNo}</div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
                  Billed Items & Formulations ({viewingBill.items.length})
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                        <th className="py-2.5 px-3">Item / Medicine</th>
                        <th className="py-2.5 px-2">Batch</th>
                        <th className="py-2.5 px-2 text-right">Qty</th>
                        <th className="py-2.5 px-2 text-right">MRP</th>
                        <th className="py-2.5 px-2 text-right">Rate</th>
                        <th className="py-2.5 px-2 text-right">GST %</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingBill.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            <div>{item.medicineName}</div>
                            {item.genericName && (
                              <div className="text-[10px] text-slate-400">{item.genericName}</div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-slate-600 font-mono text-[11px]">
                            {item.batchNumber}
                            {item.expiryDate && (
                              <div className="text-[10px] text-slate-400">Exp: {item.expiryDate}</div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-slate-900">
                            {item.qty}
                            {item.freeQty > 0 && (
                              <span className="text-[10px] text-emerald-600 ml-1">+{item.freeQty} free</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-600">
                            {formatCurrency(item.mrp, currencySymbol)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-700">
                            {formatCurrency(item.unitRate, currencySymbol)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-600">
                            {item.gstPercent}%
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(item.totalAmount, currencySymbol)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Calculation Summary */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Subtotal:</span>
                  <span>{formatCurrency(viewingBill.subtotal, currencySymbol)}</span>
                </div>
                {viewingBill.totalDiscount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount:</span>
                    <span>- {formatCurrency(viewingBill.totalDiscount, currencySymbol)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Net Taxable Amount:</span>
                  <span>{formatCurrency(viewingBill.taxableAmount, currencySymbol)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total GST Tax (CGST + SGST):</span>
                  <span>{formatCurrency(viewingBill.totalGst, currencySymbol)}</span>
                </div>
                {viewingBill.roundOff !== 0 && (
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>Round Off:</span>
                    <span>{viewingBill.roundOff > 0 ? `+${viewingBill.roundOff}` : viewingBill.roundOff}</span>
                  </div>
                )}
                <div className="border-t border-slate-300 pt-2 flex justify-between text-base font-black text-slate-900">
                  <span>Grand Total:</span>
                  <span className="text-emerald-700">{formatCurrency(viewingBill.grandTotal, currencySymbol)}</span>
                </div>

                {/* Payment Breakdown */}
                <div className="pt-2 border-t border-dashed border-slate-300 flex justify-between text-slate-700 text-xs">
                  <span>Payment ({viewingBill.paymentMode.toUpperCase()}):</span>
                  <span>Paid: {formatCurrency(viewingBill.paidAmount, currencySymbol)}</span>
                </div>
                {viewingBill.creditAmount > 0 && (
                  <div className="flex justify-between text-amber-800 font-bold text-xs">
                    <span>Customer Khata Due:</span>
                    <span>{formatCurrency(viewingBill.creditAmount, currencySymbol)}</span>
                  </div>
                )}
              </div>

              {/* Firestore Storage Confirmation */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-emerald-800 text-[11px] font-bold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Stored in Cloud Firestore: <code>generated_bills/{viewingBill.id}</code></span>
                </div>
                <span className="text-[10px] uppercase tracking-wider bg-emerald-200/60 px-2 py-0.5 rounded text-emerald-900">
                  Dual-synced
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setViewingBill(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const b = viewingBill;
                  setViewingBill(null);
                  openReprint(b);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Bill</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reprint Receipt Modal (Thermal or A4) */}
      <dialog
        ref={printDialogRef}
        className="backdrop:bg-slate-900/60 p-0 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-hidden"
      >
        {reprintBill && (
          <div className="flex flex-col h-full bg-slate-50">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">
                  {language === 'mr' ? 'बिल प्रिंट पूर्वावलोकन' : 'Print Bill Preview'} - {reprintBill.invoiceNo}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPrintFormat('thermal-80mm')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
                      printFormat === 'thermal-80mm'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Thermal (80mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintFormat('a4-tax-invoice')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
                      printFormat === 'a4-tax-invoice'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    A4 Tax Invoice
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => printDialogRef.current?.close()}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Preview Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-slate-200/50">
              <PrintReceipt
                invoice={reprintBill}
                settings={currentWorkspace?.settings ? ({ ...settings, ...currentWorkspace.settings } as any) : settings}
                format={printFormat}
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                Press Ctrl+P or click Print Now to send to printer
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printDialogRef.current?.close()}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executePrint}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Now</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
};
