import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  TrendingUp,
  Receipt,
  Download,
  Calendar,
  Printer,
  DollarSign,
  PieChart,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';
import { db } from '../db/db';
import { Invoice, StoreSettings } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { PrintReceipt } from './PrintReceipt';

interface ReportsProps {
  settings: StoreSettings | null;
}

export const ReportsView: React.FC<ReportsProps> = ({ settings }) => {
  const symbol = settings?.currencySymbol || '₹';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'all'>('month');

  // Preview / Reprint modal state
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [printFormat, setPrintFormat] = useState<'thermal-80mm' | 'a4-tax-invoice'>('thermal-80mm');
  const printDialogRef = useRef<HTMLDialogElement>(null);

  const loadData = async () => {
    const all = await db.invoices.reverse().toArray();
    setInvoices(all);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter invoices by date
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7);

  const filteredInvoices = invoices.filter((inv) => {
    if (dateFilter === 'today') {
      return inv.date === todayStr;
    } else if (dateFilter === '7days') {
      const invDate = new Date(inv.date);
      const diffDays = (now.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    } else if (dateFilter === 'month') {
      return inv.date.startsWith(currentMonthStr);
    }
    return true;
  });

  // KPI calculations
  const totalRevenue = filteredInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const totalDiscounts = filteredInvoices.reduce((s, i) => s + i.totalDiscount, 0);
  const totalTaxable = filteredInvoices.reduce((s, i) => s + i.taxableAmount, 0);
  const totalGst = filteredInvoices.reduce((s, i) => s + i.totalGst, 0);
  const avgBillValue = filteredInvoices.length > 0 ? totalRevenue / filteredInvoices.length : 0;

  // Payment Breakdown
  const cashTotal = filteredInvoices.filter((i) => i.paymentMode === 'cash').reduce((s, i) => s + i.paidAmount, 0);
  const upiTotal = filteredInvoices.filter((i) => i.paymentMode === 'upi').reduce((s, i) => s + i.paidAmount, 0);
  const cardTotal = filteredInvoices.filter((i) => i.paymentMode === 'card').reduce((s, i) => s + i.paidAmount, 0);
  const creditTotal = filteredInvoices.reduce((s, i) => s + i.creditAmount, 0);

  // GST Slab summary (0%, 5%, 12%, 18%)
  const gstSlabs: { [rate: number]: { taxable: number; gst: number } } = {
    0: { taxable: 0, gst: 0 },
    5: { taxable: 0, gst: 0 },
    12: { taxable: 0, gst: 0 },
    18: { taxable: 0, gst: 0 },
  };

  filteredInvoices.forEach((inv) => {
    inv.items.forEach((item) => {
      const rate = item.gstPercent || 12;
      if (!gstSlabs[rate]) gstSlabs[rate] = { taxable: 0, gst: 0 };
      gstSlabs[rate].taxable += item.taxableAmount;
      gstSlabs[rate].gst += item.gstAmount;
    });
  });

  // Top Selling Medicines
  const medSalesMap = new Map<string, { name: string; qty: number; revenue: number }>();
  filteredInvoices.forEach((inv) => {
    inv.items.forEach((item) => {
      const prev = medSalesMap.get(item.medicineName) || { name: item.medicineName, qty: 0, revenue: 0 };
      prev.qty += item.qty;
      prev.revenue += item.totalAmount;
      medSalesMap.set(item.medicineName, prev);
    });
  });

  const topSelling = Array.from(medSalesMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 6);

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredInvoices.length === 0) {
      alert('No sales records to export.');
      return;
    }

    const headers = [
      'Invoice No',
      'Date',
      'Time',
      'Customer Name',
      'Phone',
      'Doctor',
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

    const rows = filteredInvoices.map((i) => [
      i.invoiceNo,
      i.date,
      i.time,
      `"${i.customerName}"`,
      i.customerPhone,
      `"${i.doctorName || ''}"`,
      i.subtotal.toFixed(2),
      i.totalDiscount.toFixed(2),
      i.taxableAmount.toFixed(2),
      i.totalGst.toFixed(2),
      i.grandTotal.toFixed(2),
      i.paymentMode,
      i.paidAmount.toFixed(2),
      i.creditAmount.toFixed(2),
      i.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pharma_Sales_${dateFilter}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenReprint = (inv: Invoice) => {
    setSelectedInvoice(inv);
    printDialogRef.current?.showModal();
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Header & Date Range Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            Pharmacy Sales Analytics & GST Reports
          </h2>
          <p className="text-xs text-slate-500">
            Real-time financial dashboard, GST breakdown for tax filing, and fast-moving medicines report.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Pills */}
          <div className="bg-slate-100 p-1 rounded-xl flex space-x-1 text-xs font-bold text-slate-700">
            {[
              { id: 'today', label: 'Today' },
              { id: '7days', label: 'Last 7 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  dateFilter === f.id ? 'bg-emerald-600 text-white shadow-xs' : 'hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Sales Revenue */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Total Sales Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {formatCurrency(totalRevenue, symbol)}
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">
            {filteredInvoices.length} Bills Issued
          </p>
        </div>

        {/* Total Tax (GST) Collected */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>GST Tax Collected</span>
            <Receipt className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {formatCurrency(totalGst, symbol)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Taxable Value: <strong>{formatCurrency(totalTaxable, symbol)}</strong>
          </p>
        </div>

        {/* Discounts Given */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Discounts Conceded</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {formatCurrency(totalDiscounts, symbol)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Average Bill: <strong>{formatCurrency(avgBillValue, symbol)}</strong>
          </p>
        </div>

        {/* Khata Credit Sales */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Khata Credit Sales</span>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
          </div>
          <div className="text-2xl font-black text-red-600 mt-2 font-mono">
            {formatCurrency(creditTotal, symbol)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Cash: {formatCurrency(cashTotal, symbol)} &bull; UPI: {formatCurrency(upiTotal, symbol)}
          </p>
        </div>
      </div>

      {/* Middle Section: GST Slabs Breakdown (6 cols) & Top Selling Medicines (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* GST Tax Slabs Table */}
        <div className="lg:col-span-6 bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-emerald-600" />
            GST Tax Slabs Summary (GSTR-1 Format)
          </h3>

          <table className="w-full text-xs text-left border border-slate-200">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">Tax Slab</th>
                <th className="py-2 px-2 text-right">Taxable Turnover</th>
                <th className="py-2 px-2 text-right">CGST</th>
                <th className="py-2 px-2 text-right">SGST</th>
                <th className="py-2 px-3 text-right">Total Tax</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {[0, 5, 12, 18].map((rate) => {
                const slab = gstSlabs[rate] || { taxable: 0, gst: 0 };
                const half = slab.gst / 2;
                return (
                  <tr key={rate} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">{rate}% Slab</td>
                    <td className="py-2 px-2 text-right">{formatCurrency(slab.taxable, symbol)}</td>
                    <td className="py-2 px-2 text-right text-slate-600">{formatCurrency(half, symbol)}</td>
                    <td className="py-2 px-2 text-right text-slate-600">{formatCurrency(half, symbol)}</td>
                    <td className="py-2 px-3 text-right font-black text-slate-900">
                      {formatCurrency(slab.gst, symbol)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Top 6 Fast-moving Medicines */}
        <div className="lg:col-span-6 bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Fastest Moving Medicines in Selected Period
          </h3>

          <div className="space-y-2">
            {topSelling.length === 0 ? (
              <p className="text-xs text-slate-400 p-4 text-center">No medicine sales recorded in this period.</p>
            ) : (
              topSelling.map((med, idx) => (
                <div
                  key={med.name}
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-900">{med.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 font-mono">{med.qty} units</span>
                    <span className="text-[10px] text-slate-500 font-mono ml-2">
                      ({formatCurrency(med.revenue, symbol)})
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Bills Ledger */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Invoices Register ({filteredInvoices.length} Bills)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white font-bold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-2">Invoice No</th>
                <th className="py-2.5 px-2">Patient / Customer</th>
                <th className="py-2.5 px-2">Doctor</th>
                <th className="py-2.5 px-2 text-center">Items</th>
                <th className="py-2.5 px-2 text-center">Payment</th>
                <th className="py-2.5 px-2 text-right">Taxable</th>
                <th className="py-2.5 px-2 text-right">GST</th>
                <th className="py-2.5 px-2 text-right">Grand Total</th>
                <th className="py-2.5 px-3 text-right">Print</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    No invoices found for the selected time filter.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-600">
                      {formatDate(inv.date)} <span className="text-[10px] text-slate-400">{inv.time}</span>
                    </td>
                    <td className="py-2 px-2 font-mono font-bold text-slate-900">{inv.invoiceNo}</td>
                    <td className="py-2 px-2 font-medium text-slate-800">
                      {inv.customerName}
                      {inv.customerPhone && <span className="text-slate-400 text-[10px] ml-1 font-mono">({inv.customerPhone})</span>}
                    </td>
                    <td className="py-2 px-2 text-slate-600">{inv.doctorName || 'Self / OTC'}</td>
                    <td className="py-2 px-2 text-center">{inv.items.length}</td>
                    <td className="py-2 px-2 text-center">
                      <span
                        className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                          inv.paymentMode === 'credit'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {inv.paymentMode}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{formatCurrency(inv.taxableAmount, symbol)}</td>
                    <td className="py-2 px-2 text-right font-mono text-slate-500">
                      {formatCurrency(inv.totalGst, symbol)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-black text-slate-900">
                      {formatCurrency(inv.grandTotal, symbol)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleOpenReprint(inv)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold text-[11px] inline-flex items-center gap-1"
                      >
                        <Printer className="w-3 h-3 text-slate-500" />
                        <span>Reprint</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= REPRINT MODAL ================= */}
      <dialog
        ref={printDialogRef}
        aria-labelledby="reprint-dialog-title"
        closedby="any"
        className="rounded-2xl p-0 backdrop:bg-slate-900/60 shadow-2xl max-w-4xl w-full text-slate-900 overflow-hidden border border-slate-200"
      >
        <div className="bg-slate-900 text-white px-6 py-3 flex justify-between items-center print:hidden">
          <div className="flex items-center space-x-3">
            <h2 id="reprint-dialog-title" className="text-base font-bold">
              Reprint Invoice: {selectedInvoice?.invoiceNo}
            </h2>
            <div className="flex bg-slate-800 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setPrintFormat('thermal-80mm')}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  printFormat === 'thermal-80mm' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Thermal 80mm
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('a4-tax-invoice')}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  printFormat === 'a4-tax-invoice' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                A4 Tax Invoice
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg flex items-center gap-1"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={() => printDialogRef.current?.close()}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 bg-slate-100 max-h-[75vh] overflow-y-auto">
          {selectedInvoice && (
            <PrintReceipt invoice={selectedInvoice} settings={settings} format={printFormat} />
          )}
        </div>
      </dialog>
    </div>
  );
};

