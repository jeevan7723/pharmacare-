import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Invoice, StoreSettings } from '../types';
import { formatCurrency, formatDate, generateUpiQrUri } from '../utils/formatters';

interface PrintReceiptProps {
  invoice: Invoice;
  settings: StoreSettings | null;
  format?: 'thermal-80mm' | 'a4-tax-invoice' | 'a5';
}

export const PrintReceipt: React.FC<PrintReceiptProps> = ({
  invoice,
  settings,
  format = settings?.printFormat || 'thermal-80mm',
}) => {
  const isThermal = format === 'thermal-80mm';
  const symbol = settings?.currencySymbol || '₹';
  const cleanStoreName = settings?.storeName?.replace('& SURGICALS', '').trim() || 'HEALTHPLUS PHARMACY';

  const upiUri = settings?.upiId
    ? generateUpiQrUri(settings.upiId, settings.storeName, invoice.grandTotal, invoice.invoiceNo)
    : '';

  // Calculate HSN-wise tax breakdown for A4 invoice
  const hsnMap = new Map<
    number,
    { gstPercent: number; taxable: number; cgst: number; sgst: number; total: number }
  >();

  invoice.items.forEach((item) => {
    const prev = hsnMap.get(item.gstPercent) || {
      gstPercent: item.gstPercent,
      taxable: 0,
      cgst: 0,
      sgst: 0,
      total: 0,
    };
    prev.taxable += item.taxableAmount;
    prev.cgst += item.gstAmount / 2;
    prev.sgst += item.gstAmount / 2;
    prev.total += item.totalAmount;
    hsnMap.set(item.gstPercent, prev);
  });

  if (isThermal) {
    return (
      <div
        id="printable-receipt"
        className="max-w-[320px] mx-auto p-4 bg-white text-black font-mono text-[11px] leading-tight border border-slate-300"
      >
        {/* Header */}
        <div className="text-center pb-2 border-b border-dashed border-black">
          <h2 className="text-sm font-bold uppercase">{cleanStoreName}</h2>
          <p className="text-[10px] text-gray-700">{settings?.tagline}</p>
          <p className="text-[10px] mt-0.5">{settings?.addressLine1}, {settings?.city}</p>
          <p className="text-[10px]">Ph: {settings?.phone}</p>
          {settings?.dlNo1 && <p className="text-[10px]">DL: {settings.dlNo1}</p>}
          {settings?.gstin && <p className="text-[10px] font-bold">GSTIN: {settings.gstin}</p>}
          <div className="mt-1 pt-1 border-t border-dotted border-gray-400">
            <span className="font-bold uppercase text-[11px]">RETAIL TAX INVOICE</span>
          </div>
        </div>

        {/* Invoice & Customer Info */}
        <div className="py-2 border-b border-dashed border-black space-y-0.5 text-[10px]">
          <div className="flex justify-between">
            <span>Bill No: <strong>{invoice.invoiceNo}</strong></span>
            <span>Date: {invoice.date} {invoice.time}</span>
          </div>
          <div>
            <span>Patient: <strong>{invoice.customerName || 'Cash Customer'}</strong></span>
            {invoice.customerPhone && <span> ({invoice.customerPhone})</span>}
          </div>
          {invoice.doctorName && (
            <div>
              <span>Doctor: {invoice.doctorName}</span>
              {invoice.doctorRegNo && <span> (Reg: {invoice.doctorRegNo})</span>}
            </div>
          )}
          <div className="flex justify-between">
            <span>Payment: <strong className="uppercase">{invoice.paymentMode}</strong></span>
            <span>Status: <strong>{invoice.status.toUpperCase()}</strong></span>
          </div>
        </div>

        {/* Item Table */}
        <table className="w-full my-2 text-[10px] text-left">
          <thead>
            <tr className="border-b border-black font-bold">
              <th className="py-1">Item / Batch</th>
              <th className="text-center py-1">Exp</th>
              <th className="text-center py-1">Qty</th>
              <th className="text-right py-1">MRP</th>
              <th className="text-right py-1">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dotted divide-gray-300">
            {invoice.items.map((item, idx) => (
              <tr key={idx} className="py-0.5">
                <td className="py-0.5 pr-1">
                  <div className="font-semibold text-[10px] leading-3">{item.medicineName}</div>
                  <div className="text-[9px] text-gray-600">
                    B:{item.batchNumber} | {item.schedule}
                  </div>
                </td>
                <td className="text-center text-[9px]">{item.expiryDate}</td>
                <td className="text-center font-bold">
                  {item.qty}
                  {item.freeQty > 0 ? `+${item.freeQty}` : ''}
                </td>
                <td className="text-right">{item.unitRate.toFixed(2)}</td>
                <td className="text-right font-semibold">{item.totalAmount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Bill Calculations */}
        <div className="pt-2 border-t border-dashed border-black space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span>Items: {invoice.items.length} (Pcs: {invoice.items.reduce((s, i) => s + i.qty, 0)})</span>
            <span>Subtotal: {formatCurrency(invoice.subtotal, symbol)}</span>
          </div>

          {invoice.totalDiscount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Total Discount:</span>
              <span>- {formatCurrency(invoice.totalDiscount, symbol)}</span>
            </div>
          )}

          <div className="flex justify-between text-[10px] text-gray-600">
            <span>Taxable Amount:</span>
            <span>{formatCurrency(invoice.taxableAmount, symbol)}</span>
          </div>

          <div className="flex justify-between text-[10px] text-gray-600">
            <span>GST (CGST+SGST):</span>
            <span>{formatCurrency(invoice.totalGst, symbol)}</span>
          </div>

          {invoice.roundOff !== 0 && (
            <div className="flex justify-between text-[10px] text-gray-600">
              <span>Round Off:</span>
              <span>{invoice.roundOff > 0 ? `+${invoice.roundOff.toFixed(2)}` : invoice.roundOff.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between text-sm font-bold pt-1 border-t border-black">
            <span>NET PAYABLE:</span>
            <span>{formatCurrency(invoice.grandTotal, symbol)}</span>
          </div>

          <div className="flex justify-between text-[10px] pt-0.5">
            <span>Paid: {formatCurrency(invoice.paidAmount, symbol)}</span>
            {invoice.changeDue > 0 && (
              <span className="font-semibold">Change: {formatCurrency(invoice.changeDue, symbol)}</span>
            )}
            {invoice.creditAmount > 0 && (
              <span className="text-red-600 font-bold">Due Credit: {formatCurrency(invoice.creditAmount, symbol)}</span>
            )}
          </div>
        </div>

        {/* Dynamic UPI QR Code for instant scanning */}
        {upiUri && (
          <div className="my-3 py-2 border-t border-b border-dotted border-black flex flex-col items-center justify-center">
            <span className="text-[9px] uppercase font-bold tracking-wider mb-1">Scan & Pay via UPI</span>
            <div className="p-1 bg-white border border-black inline-block">
              <QRCodeSVG value={upiUri} size={90} level="M" />
            </div>
            <span className="text-[8px] text-gray-700 mt-1 font-mono">{settings?.upiId}</span>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-2 text-[9px] text-gray-600 space-y-1">
          <p className="whitespace-pre-line leading-relaxed">{settings?.invoiceFooterTerms}</p>
          <p className="font-bold uppercase text-[9px] mt-1">*** Wish You A Speedy Recovery! ***</p>
        </div>
      </div>
    );
  }

  // A4 / A5 Tax Invoice Layout
  return (
    <div
      id="printable-receipt"
      className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans border border-slate-300 text-xs shadow-sm"
    >
      {/* Top Header */}
      <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {cleanStoreName}
          </h1>
          <p className="text-xs text-slate-600 font-medium">{settings?.tagline}</p>
          <p className="text-xs text-slate-700 mt-1">
            {settings?.addressLine1}, {settings?.addressLine2}, {settings?.city} - {settings?.pincode}
          </p>
          <p className="text-xs text-slate-700">
            <strong>Phone:</strong> {settings?.phone} | <strong>Email:</strong> {settings?.email}
          </p>
          <div className="flex gap-4 mt-2 text-[11px] font-mono">
            {settings?.dlNo1 && (
              <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                <strong>DL No:</strong> {settings.dlNo1} {settings.dlNo2 ? `/ ${settings.dlNo2}` : ''}
              </span>
            )}
            {settings?.gstin && (
              <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                <strong>GSTIN:</strong> {settings.gstin}
              </span>
            )}
            {settings?.fssaiNo && (
              <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                <strong>FSSAI:</strong> {settings.fssaiNo}
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="inline-block bg-slate-900 text-white font-bold text-sm px-4 py-1 rounded">
            TAX INVOICE
          </div>
          <div className="mt-2 text-xs space-y-1 font-mono">
            <div><strong>Invoice No:</strong> {invoice.invoiceNo}</div>
            <div><strong>Date:</strong> {formatDate(invoice.date)}</div>
            <div><strong>Time:</strong> {invoice.time}</div>
            <div><strong>Payment Mode:</strong> <span className="uppercase font-bold">{invoice.paymentMode}</span></div>
          </div>
        </div>
      </div>

      {/* Bill To & Doctor Prescribed By */}
      <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Patient / Buyer Details</span>
          <p className="font-bold text-sm text-slate-900">{invoice.customerName || 'Cash Customer'}</p>
          {invoice.customerPhone && <p className="text-slate-700">Phone: {invoice.customerPhone}</p>}
        </div>

        <div className="border-l border-slate-300 pl-4">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Prescribed By Doctor</span>
          <p className="font-bold text-sm text-slate-900">{invoice.doctorName || 'Self / OTC'}</p>
          {invoice.doctorRegNo && <p className="text-slate-700">Reg No: {invoice.doctorRegNo}</p>}
        </div>
      </div>

      {/* Medicines Table */}
      <table className="w-full border-collapse border border-slate-300 mb-4 text-xs">
        <thead>
          <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 text-left font-bold">
            <th className="p-2 border border-slate-300 w-8 text-center">#</th>
            <th className="p-2 border border-slate-300">Description of Medicine / Formulation</th>
            <th className="p-2 border border-slate-300 text-center">Batch</th>
            <th className="p-2 border border-slate-300 text-center">Exp Date</th>
            <th className="p-2 border border-slate-300 text-center">Qty</th>
            <th className="p-2 border border-slate-300 text-right">MRP</th>
            <th className="p-2 border border-slate-300 text-right">Rate</th>
            <th className="p-2 border border-slate-300 text-right">Disc %</th>
            <th className="p-2 border border-slate-300 text-right">GST %</th>
            <th className="p-2 border border-slate-300 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr key={index} className="border-b border-slate-200 hover:bg-slate-50">
              <td className="p-2 border border-slate-300 text-center">{index + 1}</td>
              <td className="p-2 border border-slate-300">
                <div className="font-bold text-slate-900">{item.medicineName}</div>
                <div className="text-[10px] text-slate-500 font-normal">
                  {item.genericName} | {item.manufacturer} | {item.schedule}
                </div>
              </td>
              <td className="p-2 border border-slate-300 text-center font-mono">{item.batchNumber}</td>
              <td className="p-2 border border-slate-300 text-center font-mono">{item.expiryDate}</td>
              <td className="p-2 border border-slate-300 text-center font-bold">
                {item.qty} {item.freeQty > 0 && <span className="text-emerald-600 font-normal">+{item.freeQty} Free</span>}
              </td>
              <td className="p-2 border border-slate-300 text-right">{item.mrp.toFixed(2)}</td>
              <td className="p-2 border border-slate-300 text-right">{item.unitRate.toFixed(2)}</td>
              <td className="p-2 border border-slate-300 text-right">{item.discountPercent}%</td>
              <td className="p-2 border border-slate-300 text-right">{item.gstPercent}%</td>
              <td className="p-2 border border-slate-300 text-right font-bold">{item.totalAmount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Tax Breakdown & Total Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* GST Tax Slabs Table */}
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">GST Tax Summary</span>
          <table className="w-full border border-slate-300 text-[10px] text-center mt-1">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                <th className="p-1 border border-slate-300">Rate %</th>
                <th className="p-1 border border-slate-300">Taxable</th>
                <th className="p-1 border border-slate-300">CGST</th>
                <th className="p-1 border border-slate-300">SGST</th>
                <th className="p-1 border border-slate-300">Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(hsnMap.values()).map((row) => (
                <tr key={row.gstPercent} className="border-b border-slate-200">
                  <td className="p-1 border border-slate-300 font-bold">{row.gstPercent}%</td>
                  <td className="p-1 border border-slate-300">{row.taxable.toFixed(2)}</td>
                  <td className="p-1 border border-slate-300">{row.cgst.toFixed(2)}</td>
                  <td className="p-1 border border-slate-300">{row.sgst.toFixed(2)}</td>
                  <td className="p-1 border border-slate-300 font-semibold">{(row.cgst + row.sgst).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {upiUri && (
            <div className="flex items-center gap-3 mt-3 p-2 bg-slate-50 border border-slate-200 rounded">
              <QRCodeSVG value={upiUri} size={64} level="M" />
              <div className="text-[10px]">
                <p className="font-bold text-slate-800">Scan to Pay via UPI</p>
                <p className="font-mono text-slate-600">{settings?.upiId}</p>
                <p className="text-slate-500">Payable: {formatCurrency(invoice.grandTotal, symbol)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Grand Total Box */}
        <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg space-y-2">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Subtotal Gross:</span>
            <span>{formatCurrency(invoice.subtotal, symbol)}</span>
          </div>
          {invoice.totalDiscount > 0 && (
            <div className="flex justify-between text-xs text-emerald-600 font-medium">
              <span>Total Discount:</span>
              <span>- {formatCurrency(invoice.totalDiscount, symbol)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-slate-600">
            <span>Total Tax (GST):</span>
            <span>{formatCurrency(invoice.totalGst, symbol)}</span>
          </div>
          {invoice.roundOff !== 0 && (
            <div className="flex justify-between text-xs text-slate-600">
              <span>Round Off:</span>
              <span>{invoice.roundOff > 0 ? `+${invoice.roundOff.toFixed(2)}` : invoice.roundOff.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-black text-slate-900 border-t-2 border-slate-900 pt-2">
            <span>GRAND TOTAL:</span>
            <span>{formatCurrency(invoice.grandTotal, symbol)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-700 pt-1 border-t border-slate-200">
            <span>Amount Paid: {formatCurrency(invoice.paidAmount, symbol)}</span>
            {invoice.creditAmount > 0 && (
              <span className="text-red-600 font-bold">Credit Due: {formatCurrency(invoice.creditAmount, symbol)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Terms & Pharmacist Signature */}
      <div className="grid grid-cols-2 gap-8 border-t border-slate-300 pt-4 text-[10px] text-slate-600">
        <div>
          <p className="font-bold uppercase text-slate-800 mb-1">Terms & Conditions:</p>
          <p className="whitespace-pre-line leading-relaxed">{settings?.invoiceFooterTerms}</p>
        </div>

        <div className="text-right flex flex-col justify-end">
          <div className="mb-8">
            <span className="font-bold text-slate-800">For {cleanStoreName}</span>
          </div>
          <div className="border-t border-slate-400 inline-block pt-1 text-slate-700">
            Authorized Signatory / Registered Pharmacist
          </div>
        </div>
      </div>
    </div>
  );
};

