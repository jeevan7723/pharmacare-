import React, { useState } from 'react';
import {
  ShoppingCart,
  User,
  Stethoscope,
  ChevronUp,
  ChevronDown,
  PauseCircle,
  Trash2,
  ArrowRight,
  Pill,
  Phone,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useBillingDraft } from '../context/BillingDraftContext';
import { formatCurrency } from '../utils/formatters';

interface ActiveBillDockProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  symbol?: string;
  onRefreshStats?: () => void;
}

export const ActiveBillDock: React.FC<ActiveBillDockProps> = ({
  activeTab,
  setActiveTab,
  symbol = '₹',
  onRefreshStats,
}) => {
  const {
    customerPhone,
    customerName,
    doctorName,
    cart,
    grandTotal,
    hasActiveDraft,
    totalQty,
    clearDraft,
    holdDraft,
  } = useBillingDraft();

  const [isExpanded, setIsExpanded] = useState(false);

  // Only display when outside POS and there is an active draft
  if (activeTab === 'billing' || !hasActiveDraft) return null;

  const handleHold = async () => {
    if (cart.length === 0) {
      alert('Cart is empty. Add medicines before holding the bill.');
      return;
    }
    const ok = await holdDraft(symbol);
    if (ok) {
      onRefreshStats?.();
      alert('Active bill has been moved to Held Bills queue!');
    }
  };

  const handleClear = () => {
    if (confirm('Clear the current unfinished bill draft?')) {
      clearDraft();
    }
  };

  return (
    <div className="shrink-0 bg-slate-900 border-t-2 border-emerald-500 text-white shadow-2xl z-40 transition-all select-none">
      {/* Expanded Items Preview Drawer */}
      {isExpanded && cart.length > 0 && (
        <div className="bg-slate-950/95 border-b border-slate-800 p-4 max-h-60 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs text-slate-400 font-semibold uppercase tracking-wider">
              <span>Medicines in Active Bill ({cart.length} items, {totalQty} units)</span>
              <span>Total: {formatCurrency(grandTotal, symbol)}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
              {cart.map((item, idx) => (
                <div
                  key={`${item.medicineId}-${item.batchId}-${idx}`}
                  className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-white truncate">{item.medicineName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Batch: {item.batchNumber} | Exp: {item.expiryDate}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-emerald-400">
                      {formatCurrency(item.totalAmount, symbol)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Qty: <span className="text-white font-bold">{item.qty}</span>
                      {item.freeQty > 0 && <span className="text-emerald-300">+{item.freeQty}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Persistent Dock Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Active Bill Status & Customer Info */}
        <div className="flex items-center space-x-3 min-w-0">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="hidden sm:inline">Active Bill in Progress</span>
            <span className="sm:hidden">Active Bill</span>
          </div>

          <div className="flex items-center space-x-3 text-xs min-w-0">
            {/* Patient Name / Phone */}
            <div className="flex items-center space-x-1.5 truncate">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-bold text-slate-100 truncate">
                {customerName.trim() || 'Walk-in Patient'}
              </span>
              {customerPhone && (
                <span className="text-slate-400 font-mono text-[11px] hidden md:inline">
                  ({customerPhone})
                </span>
              )}
            </div>

            {/* Doctor */}
            {doctorName && (
              <div className="hidden lg:flex items-center space-x-1 text-slate-400 truncate">
                <span>•</span>
                <Stethoscope className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span className="text-slate-300 truncate">Dr. {doctorName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Middle/Right: Summary & Actions */}
        <div className="flex items-center space-x-3 shrink-0">
          {/* Cart Items & Total Amount */}
          <div className="text-right">
            <div className="text-[11px] text-slate-400">
              <span>{cart.length} items ({totalQty} units)</span>
            </div>
            <div className="text-base font-black font-mono text-emerald-400 leading-none">
              {formatCurrency(grandTotal, symbol)}
            </div>
          </div>

          {/* Toggle View Items button */}
          {cart.length > 0 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs flex items-center gap-1 transition-colors"
              title={isExpanded ? 'Hide items' : 'View cart items'}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              <span className="hidden xl:inline">{isExpanded ? 'Hide Items' : 'View Items'}</span>
            </button>
          )}

          {/* Hold Bill Button */}
          {cart.length > 0 && (
            <button
              onClick={handleHold}
              title="Save current bill to held queue (F8)"
              className="px-2.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-1 transition-all"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hold</span>
            </button>
          )}

          {/* Clear Button */}
          <button
            onClick={handleClear}
            title="Clear current bill draft"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Primary Action: Resume Bill in POS */}
          <button
            onClick={() => setActiveTab('billing')}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/30 flex items-center gap-2 transform active:scale-95 transition-all"
            title="Return to Point of Sale (F2)"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Resume Bill (POS)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

