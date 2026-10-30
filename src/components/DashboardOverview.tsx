import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  Users,
  DollarSign,
  PlusCircle,
  Truck,
  FileText,
  Clock,
  ArrowRight,
  ShieldAlert,
  Archive,
  Printer,
  Receipt,
  UserCheck,
} from 'lucide-react';
import { db } from '../db/db';
import { Medicine, Batch, Invoice, Customer, StoreSettings } from '../types';
import { formatCurrency, formatDate, checkExpiryStatus } from '../utils/formatters';

interface DashboardOverviewProps {
  settings: StoreSettings | null;
  setActiveTab: (tab: string) => void;
  expiredCount: number;
  criticalExpiryCount: number;
  lowStockCount: number;
  heldBillsCount: number;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  settings,
  setActiveTab,
  expiredCount,
  criticalExpiryCount,
  lowStockCount,
  heldBillsCount,
}) => {
  const symbol = settings?.currencySymbol || '₹';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    const load = async () => {
      const allInvs = await db.invoices.reverse().toArray();
      const allMeds = await db.medicines.toArray();
      const allBatches = await db.batches.toArray();
      const allCusts = await db.customers.toArray();

      setInvoices(allInvs);
      setMedicines(allMeds);
      setBatches(allBatches);
      setCustomers(allCusts);
    };
    load();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7);

  // Today's stats
  const todayInvoices = invoices.filter((i) => i.date === todayStr);
  const todayRevenue = todayInvoices.reduce((s, i) => s + i.grandTotal, 0);

  // Month stats
  const monthInvoices = invoices.filter((i) => i.date.startsWith(currentMonthStr));
  const monthRevenue = monthInvoices.reduce((s, i) => s + i.grandTotal, 0);

  // Inventory stats
  const totalStockUnits = batches.reduce((s, b) => s + b.stockQty, 0);

  // Khata stats
  const totalKhataDebt = customers.reduce((s, c) => s + c.outstandingBalance, 0);
  const customersWithDebt = customers.filter((c) => c.outstandingBalance > 0).length;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white rounded-2xl p-6 shadow-md border border-slate-700/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] uppercase font-bold tracking-wider">
              Pharmacy POS Terminal
            </span>
            <span className="text-slate-400 text-xs">&bull; {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white mt-1">
            Welcome to {settings?.storeName?.replace('& SURGICALS', '').trim() || 'HealthPlus Pharmacy'}
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            {settings?.tagline || 'Manage fast counter sales, drug batches, wholesaler purchases, and customer credit.'}
          </p>
        </div>
      </div>

      {/* Critical Alert Banners */}
      {(expiredCount > 0 || criticalExpiryCount > 0 || lowStockCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {expiredCount > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <ShieldAlert className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-red-900">
                    {expiredCount} Medicine Batch{expiredCount > 1 ? 'es are' : ' is'} EXPIRED!
                  </h4>
                  <p className="text-[11px] text-red-700">
                    Drug compliance required: pull these packs off shelves and create a distributor return sheet.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('alerts')}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shrink-0 flex items-center gap-1"
              >
                <span>Inspect</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {lowStockCount > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-900">
                    {lowStockCount} Medicine{lowStockCount > 1 ? 's are' : ''} Running Low on Stock
                  </h4>
                  <p className="text-[11px] text-amber-700">
                    Stock count has fallen below minimum alert threshold.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('alerts')}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shrink-0 flex items-center gap-1"
              >
                <span>Re-order</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-emerald-500 transition-colors">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Today's Counter Sales</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {formatCurrency(todayRevenue, symbol)}
          </div>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1">
            {todayInvoices.length} Bills issued today
          </p>
        </div>

        {/* Month Sales */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-emerald-500 transition-colors">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>This Month's Sales</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {formatCurrency(monthRevenue, symbol)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {monthInvoices.length} Bills in {new Date().toLocaleString('default', { month: 'short' })}
          </p>
        </div>

        {/* Total Stock in Store */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-emerald-500 transition-colors">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Inventory in Store</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {medicines.length} Medicines
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {batches.length} Batches ({totalStockUnits.toLocaleString()} units in stock)
          </p>
        </div>

        {/* Khata Credit Outstanding */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-emerald-500 transition-colors">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Khata Credit Due</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-600 mt-2 font-mono">
            {formatCurrency(totalKhataDebt, symbol)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Due from <strong>{customersWithDebt}</strong> neighborhood patients
          </p>
        </div>
      </div>

      {/* Quick Action Station */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Quick Operations Station
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => setActiveTab('billing')}
            className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center mb-2 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-slate-900">Counter POS</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Press F2 for New Bill</div>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center mb-2 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Package className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-slate-900">Add Medicine</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Manage master catalogue</div>
          </button>

          <button
            onClick={() => setActiveTab('purchase')}
            className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center mb-2 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Truck className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-slate-900">Stock Inward</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Distributor purchase bill</div>
          </button>

          <button
            onClick={() => setActiveTab('customers')}
            className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center mb-2 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-slate-900">Receive Khata</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Patient payment receipt</div>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center mb-2 group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <Receipt className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-slate-900">GST Reports</div>
            <div className="text-[10px] text-slate-500 mt-0.5">GSTR-1 tax summary</div>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center mb-2 group-hover:bg-slate-900 group-hover:text-white transition-colors">
              <FileText className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-slate-900">Backup DB</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Download full JSON data</div>
          </button>
        </div>
      </div>

      {/* Recent Bills Feed & Store Overview Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Invoices Table (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>Recent Counter Bills</span>
            </h3>
            <button
              onClick={() => setActiveTab('reports')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>View All Register</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Bill No</th>
                  <th className="py-2.5 px-2">Time</th>
                  <th className="py-2.5 px-2">Patient</th>
                  <th className="py-2.5 px-2 text-center">Items</th>
                  <th className="py-2.5 px-2 text-center">Payment</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No invoices created yet. Start a bill by clicking "Quick New Bill".
                    </td>
                  </tr>
                ) : (
                  invoices.slice(0, 6).map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{inv.invoiceNo}</td>
                      <td className="py-2.5 px-2 text-slate-500">{inv.time}</td>
                      <td className="py-2.5 px-2 font-medium text-slate-900">{inv.customerName}</td>
                      <td className="py-2.5 px-2 text-center text-slate-600">{inv.items.length}</td>
                      <td className="py-2.5 px-2 text-center">
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
                      <td className="py-2.5 px-3 text-right font-black font-mono text-slate-900">
                        {formatCurrency(inv.grandTotal, symbol)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fast Moving Categories & Drug Rules (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Drug Regulatory Standards
            </h3>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-900">
                <span className="font-bold">Schedule H / H1:</span> Doctor prescription required. Dispensing register entry mandatory.
              </div>
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
                <span className="font-bold">OTC Formulations:</span> Open for retail over-the-counter dispensing without prescription.
              </div>
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900">
                <span className="font-bold">Drug Licenses:</span> Form 20B & 21B issued under Drugs and Cosmetics Act.
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-md">
            <h4 className="text-xs uppercase font-bold tracking-wider text-emerald-200">
              Need to Add a Wholesaler Bill?
            </h4>
            <p className="text-xs text-emerald-100 mt-1">
              Add inward distributor bills to immediately increase your stock batch quantities and cost price.
            </p>
            <button
              onClick={() => setActiveTab('purchase')}
              className="mt-3 px-3.5 py-2 bg-white text-emerald-900 font-bold text-xs rounded-xl shadow-xs hover:bg-emerald-50 flex items-center gap-1.5"
            >
              <Truck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Open Stock Inward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

