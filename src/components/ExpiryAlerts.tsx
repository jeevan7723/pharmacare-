import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Clock,
  Archive,
  RefreshCw,
  Printer,
  Trash2,
  MapPin,
  Building2,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { db } from '../db/db';
import { Medicine, Batch, StoreSettings } from '../types';
import { formatCurrency, checkExpiryStatus } from '../utils/formatters';

interface ExpiryAlertsProps {
  settings: StoreSettings | null;
  onRefreshStats: () => void;
}

export const ExpiryAlerts: React.FC<ExpiryAlertsProps> = ({ settings, onRefreshStats }) => {
  const symbol = settings?.currencySymbol || '₹';

  const [activeTab, setActiveTab] = useState<'expired' | 'critical' | 'warning' | 'lowstock'>('expired');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  const loadData = async () => {
    const meds = await db.medicines.toArray();
    const b = await db.batches.toArray();
    setMedicines(meds);
    setBatches(b);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute expired, critical (<30d), and warning (<90d) batches
  const categorizedBatches = batches.map((batch) => {
    const med = medicines.find((m) => m.id === batch.medicineId);
    const exp = checkExpiryStatus(batch.expiryDate);
    return {
      batch,
      medicine: med,
      expStatus: exp,
      lossValue: batch.stockQty * batch.purchaseRate,
    };
  });

  const expiredList = categorizedBatches.filter((item) => item.expStatus.status === 'expired' && item.batch.stockQty > 0);
  const criticalList = categorizedBatches.filter((item) => item.expStatus.status === 'critical' && item.batch.stockQty > 0);
  const warningList = categorizedBatches.filter((item) => item.expStatus.status === 'warning' && item.batch.stockQty > 0);

  // Compute low stock medicines
  const lowStockList = medicines
    .map((med) => {
      const medBatches = batches.filter((b) => b.medicineId === med.id);
      const totalStock = medBatches.reduce((s, b) => s + b.stockQty, 0);
      return {
        medicine: med,
        totalStock,
        isLow: totalStock <= med.minStockAlert,
        batches: medBatches,
      };
    })
    .filter((item) => item.isLow);

  // Remove / Write-off batch stock
  const handleWriteOff = async (batchId: string, medicineName: string) => {
    if (!confirm(`Mark remaining stock of ${medicineName} as written off / returned to distributor? Stock will be set to 0.`)) return;
    await db.batches.update(batchId, { stockQty: 0 });
    await loadData();
    onRefreshStats();
  };

  const totalExpiredLoss = expiredList.reduce((s, i) => s + i.lossValue, 0);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Header Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Drug Expiry & Low Stock Watchtower
          </h2>
          <p className="text-xs text-slate-500">
            Mandatory pharmacy compliance: monitor drug expiration dates and generate distributor return sheets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Return Sheet</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Expired Stock Card */}
        <div
          onClick={() => setActiveTab('expired')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeTab === 'expired'
              ? 'border-red-500 bg-red-50/70 shadow-sm ring-2 ring-red-400'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wider">Expired Stock</span>
            <span className="w-3 h-3 rounded-full bg-red-600 animate-ping"></span>
          </div>
          <div className="text-2xl font-black text-red-700 mt-2 font-mono">{expiredList.length} Batches</div>
          <p className="text-[11px] text-red-600 mt-1">
            Cost Loss: <strong>{formatCurrency(totalExpiredLoss, symbol)}</strong>
          </p>
        </div>

        {/* Critical (<30d) Card */}
        <div
          onClick={() => setActiveTab('critical')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeTab === 'critical'
              ? 'border-rose-500 bg-rose-50/70 shadow-sm ring-2 ring-rose-400'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Expiring &lt; 30 Days</span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2 font-mono">{criticalList.length} Batches</div>
          <p className="text-[11px] text-rose-600 mt-1">Return to supplier for credit</p>
        </div>

        {/* Warning (31-90d) Card */}
        <div
          onClick={() => setActiveTab('warning')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeTab === 'warning'
              ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-2 ring-amber-400'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Expiring 31-90 Days</span>
            <Calendar className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2 font-mono">{warningList.length} Batches</div>
          <p className="text-[11px] text-amber-600 mt-1">Prioritize selling first (FEFO)</p>
        </div>

        {/* Low Stock Card */}
        <div
          onClick={() => setActiveTab('lowstock')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeTab === 'lowstock'
              ? 'border-blue-500 bg-blue-50/70 shadow-sm ring-2 ring-blue-400'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Low Stock Re-order</span>
            <Archive className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-700 mt-2 font-mono">{lowStockList.length} Items</div>
          <p className="text-[11px] text-blue-600 mt-1">Stock below threshold alert</p>
        </div>
      </div>

      {/* Main Tab View */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Table for Expired, Critical, and Warning batches */}
        {activeTab !== 'lowstock' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Medicine Name & Formulation</th>
                  <th className="py-3 px-2">Rack Location</th>
                  <th className="py-3 px-2">Batch No</th>
                  <th className="py-3 px-2">Expiry Date</th>
                  <th className="py-3 px-2 text-center">Remaining Stock</th>
                  <th className="py-3 px-2 text-right">Cost Rate</th>
                  <th className="py-3 px-2 text-right">MRP</th>
                  <th className="py-3 px-2 text-right">Potential Loss</th>
                  <th className="py-3 px-2">Distributor</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(activeTab === 'expired'
                  ? expiredList
                  : activeTab === 'critical'
                  ? criticalList
                  : warningList
                ).length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      Great news! No batches in this category.
                    </td>
                  </tr>
                ) : (
                  (activeTab === 'expired'
                    ? expiredList
                    : activeTab === 'critical'
                    ? criticalList
                    : warningList
                  ).map(({ batch, medicine, expStatus, lossValue }) => (
                    <tr key={batch.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{medicine?.name || batch.medicineName}</div>
                        <div className="text-[10px] text-slate-500">{medicine?.genericName}</div>
                      </td>

                      <td className="py-2.5 px-2 font-mono text-slate-700">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-amber-600" />
                          <span>{medicine?.rack} - {medicine?.shelf}</span>
                        </div>
                      </td>

                      <td className="py-2.5 px-2 font-mono font-bold text-slate-800">{batch.batchNumber}</td>

                      <td className="py-2.5 px-2">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${expStatus.badgeClass}`}>
                          {batch.expiryDate} ({expStatus.label})
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center font-black text-sm text-slate-800 font-mono">
                        {batch.stockQty} {medicine?.unit || 'Strips'}
                      </td>

                      <td className="py-2.5 px-2 text-right font-mono">{batch.purchaseRate.toFixed(2)}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-500">{batch.mrp.toFixed(2)}</td>

                      <td className="py-2.5 px-2 text-right font-mono font-bold text-red-600">
                        {formatCurrency(lossValue, symbol)}
                      </td>

                      <td className="py-2.5 px-2 text-slate-600 text-[11px]">
                        {batch.supplierName || 'Primary Wholesaler'}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleWriteOff(batch.id, medicine?.name || batch.medicineName)}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-[11px] font-bold"
                          title="Write off or Return to supplier"
                        >
                          Write Off (0)
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Table for Low Stock Re-order */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Medicine Name</th>
                  <th className="py-3 px-2">Category</th>
                  <th className="py-3 px-2">Rack Location</th>
                  <th className="py-3 px-2 text-center">Current Total Stock</th>
                  <th className="py-3 px-2 text-center">Min Alert Level</th>
                  <th className="py-3 px-2 text-center">Shortage</th>
                  <th className="py-3 px-2">Manufacturer</th>
                  <th className="py-3 px-3 text-right">Suggested Re-order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {lowStockList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      All medicines are well stocked above their minimum alert threshold!
                    </td>
                  </tr>
                ) : (
                  lowStockList.map(({ medicine, totalStock }) => {
                    const shortage = medicine.minStockAlert - totalStock;
                    const suggestedOrder = Math.max(30, shortage * 3);

                    return (
                      <tr key={medicine.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{medicine.name}</div>
                          <div className="text-[10px] text-slate-500">{medicine.genericName}</div>
                        </td>
                        <td className="py-2.5 px-2">{medicine.category}</td>
                        <td className="py-2.5 px-2 font-mono text-slate-700">
                          {medicine.rack} - {medicine.shelf}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-red-600 font-mono text-sm">
                          {totalStock} {medicine.unit}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-600">
                          {medicine.minStockAlert}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-amber-600 font-mono">
                          -{shortage}
                        </td>
                        <td className="py-2.5 px-2 text-slate-600">{medicine.manufacturer}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          Order +{suggestedOrder} {medicine.unit}s
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

