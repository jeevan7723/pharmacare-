import React, { useEffect, useRef, useState } from 'react';
import { X, Printer, Copy, Check, Barcode, MapPin, Tag, ShieldCheck } from 'lucide-react';
import { Medicine, Batch, StoreSettings } from '../types';
import { formatCurrency } from '../utils/formatters';
import { renderBarcode } from '../utils/barcodeGenerator';
import { useLanguage } from '../context/LanguageContext';

interface BarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicine: Medicine | null;
  batch?: Batch | null;
  settings: StoreSettings | null;
}

export const BarcodeModal: React.FC<BarcodeModalProps> = ({
  isOpen,
  onClose,
  medicine,
  batch,
  settings,
}) => {
  const { t } = useLanguage();
  const symbol = settings?.currencySymbol || '₹';
  const storeName = settings?.storeName || 'PHARMACARE';

  const svgRef = useRef<SVGSVGElement>(null);
  const [copied, setCopied] = useState(false);
  const [printCopies, setPrintCopies] = useState<number>(1);

  const barcodeValue = batch?.barcode || medicine?.barcode || '';
  const mrp = batch?.mrp || medicine?.mrp || 0;
  const saleRate = batch?.saleRate || medicine?.saleRate || mrp;
  const batchNo = batch?.batchNumber || 'STANDARD';
  const expDate = batch?.expiryDate || 'N/A';

  useEffect(() => {
    if (isOpen && svgRef.current && barcodeValue) {
      renderBarcode(svgRef.current, barcodeValue, {
        height: 50,
        width: 1.8,
        fontSize: 13,
        displayValue: true,
      });
    }
  }, [isOpen, barcodeValue]);

  if (!isOpen || !medicine) return null;

  const handleCopyBarcode = () => {
    if (!barcodeValue) return;
    navigator.clipboard.writeText(barcodeValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Barcode className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm">Medicine Barcode Sticker</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Printable Sticker Preview Card */}
          <div
            id="printable-barcode-sticker"
            className="p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center text-center shadow-inner relative"
          >
            <div className="text-[10px] uppercase font-bold tracking-widest text-emerald-800">
              {storeName}
            </div>
            <div className="font-black text-slate-900 text-base leading-tight mt-0.5">
              {medicine.name}
            </div>
            <div className="text-[11px] text-slate-600 font-medium">
              {medicine.genericName}
            </div>

            {/* Barcode SVG */}
            <div className="my-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs w-full flex justify-center">
              <svg ref={svgRef} className="max-w-full h-auto"></svg>
            </div>

            {/* Product Meta details */}
            <div className="grid grid-cols-2 gap-2 w-full text-[11px] pt-1 border-t border-slate-200 font-mono text-left">
              <div>
                <span className="text-slate-500">Batch:</span>{' '}
                <strong className="text-slate-900 font-bold">{batchNo}</strong>
              </div>
              <div className="text-right">
                <span className="text-slate-500">Exp:</span>{' '}
                <strong className="text-slate-900 font-bold">{expDate}</strong>
              </div>
              <div>
                <span className="text-slate-500">Rack:</span>{' '}
                <strong className="text-slate-900">{medicine.rack} - {medicine.shelf}</strong>
              </div>
              <div className="text-right">
                <span className="text-slate-500">MRP:</span>{' '}
                <strong className="text-emerald-700 font-bold text-xs">{formatCurrency(mrp, symbol)}</strong>
              </div>
            </div>
          </div>

          {/* Quick Barcode Action & Scan Notice */}
          <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-950 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Ready for laser/POS scanner billing</span>
            </div>
            <button
              onClick={handleCopyBarcode}
              className="px-2.5 py-1 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Print Copies Control */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <label className="font-bold text-slate-700">Stickers to print:</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100"
                value={printCopies}
                onChange={(e) => setPrintCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-16 text-center font-mono font-bold px-2 py-1 border border-slate-300 rounded-lg"
              />
              <span className="text-slate-500">copy(s)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-all"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Label</span>
          </button>
        </div>
      </div>
    </div>
  );
};
