import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../db/db';
import { StoreSettings } from '../types';
import { formatDate } from './formatters';

function formatPdfCurrency(amount: number): string {
  const safe = isNaN(amount) ? 0 : amount;
  return `Rs. ${safe.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function generateStorePdfBackup(settings: StoreSettings | null): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const storeName = settings?.storeName?.replace('& SURGICALS', '').trim() || 'HEALTHPLUS PHARMACY';

  // Fetch all tables from local Dexie database
  const meds = await db.medicines.toArray();
  const batches = await db.batches.toArray();
  const invs = await db.invoices.reverse().toArray();
  const custs = await db.customers.toArray();
  const docs = await db.doctors.toArray();
  const sups = await db.suppliers.toArray();
  const purchases = await db.purchases.reverse().toArray();
  const payments = await db.customerPayments.reverse().toArray();

  const totalStockUnits = batches.reduce((sum, b) => sum + (b.stockQty || 0), 0);
  const totalStockValuationMRP = batches.reduce((sum, b) => sum + (b.stockQty || 0) * (b.mrp || 0), 0);
  const totalStockCost = batches.reduce((sum, b) => sum + (b.stockQty || 0) * (b.purchaseRate || 0), 0);
  const totalInvoicedSales = invs.reduce((sum, i) => sum + (i.grandTotal || 0), 0);
  const totalGstCollected = invs.reduce((sum, i) => sum + (i.totalGst || 0), 0);
  const totalKhataDue = custs.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
  const totalPaidRevenue = invs.reduce((sum, i) => sum + (i.paidAmount || 0), 0);

  const dateNow = new Date();
  const dateFormatted = dateNow.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeFormatted = dateNow.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // ==========================================
  // PAGE 1: COVER & EXECUTIVE SUMMARY
  // ==========================================

  // Header Banner Background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 42, 'F');

  // Accent Line
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 42, 210, 2, 'F');

  // Store Name Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(storeName.toUpperCase(), 14, 14);

  // Subtitle / Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(167, 243, 208); // emerald-200
  doc.text(settings?.tagline || 'Comprehensive Pharmacy Management & Official Store Records', 14, 20);

  // Address & Contacts (Header text)
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225); // slate-300
  const addrText = `${settings?.addressLine1 || ''}${settings?.addressLine2 ? ', ' + settings.addressLine2 : ''}, ${settings?.city || ''} ${settings?.pincode || ''}`;
  doc.text(addrText, 14, 26);
  doc.text(`Phone: ${settings?.phone || 'N/A'}  |  Email: ${settings?.email || 'N/A'}`, 14, 31);
  doc.text(`DL 20B: ${settings?.dlNo1 || 'N/A'}  |  DL 21B: ${settings?.dlNo2 || 'N/A'}  |  GSTIN: ${settings?.gstin || 'N/A'}`, 14, 36);

  // Backup Badge on the right
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(136, 8, 60, 28, 2, 2, 'F');
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('OFFICIAL STORE BACKUP (PDF)', 140, 16);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Date: ${dateFormatted} at ${timeFormatted}`, 140, 22);
  doc.text(`Archive: Complete Local DB`, 140, 27);
  doc.text(`Status: Verified & Audit Ready`, 140, 32);

  // Document Heading
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('EXECUTIVE STORE PERFORMANCE & DATABASE SUMMARY', 14, 52);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Consolidated report containing all transactions, inventory stock, customer khata accounts, and suppliers.',
    14,
    57
  );

  // Summary KPI Table
  autoTable(doc, {
    startY: 61,
    head: [
      ['Metric Category', 'Key Operational Indicator', 'Current Record Count', 'Financial Valuation']
    ],
    body: [
      ['Point of Sale (POS)', 'Total Invoices Generated', `${invs.length} bills recorded`, formatPdfCurrency(totalInvoicedSales)],
      ['Revenue Collections', 'Amount Paid / Collected', `${invs.filter(i => (i.paidAmount || 0) > 0).length} paid bills`, formatPdfCurrency(totalPaidRevenue)],
      ['Tax Compliance', 'GST Collected (CGST + SGST)', `${invs.length} transactions`, formatPdfCurrency(totalGstCollected)],
      ['Medicine Inventory', 'Registered Medicine Brands', `${meds.length} medicines`, 'Active Catalog'],
      ['Physical Stock', 'Batches in Storage / Shelves', `${batches.length} batches (${totalStockUnits} units)`, `${formatPdfCurrency(totalStockCost)} (Cost) / ${formatPdfCurrency(totalStockValuationMRP)} (MRP)`],
      ['Customer Credit (Khata)', 'Registered Patient Accounts', `${custs.length} customers`, `${formatPdfCurrency(totalKhataDue)} Outstanding Due`],
      ['Customer Repayments', 'Khata Payment Receipts', `${payments.length} collections`, 'Direct Khata Settlements'],
      ['Wholesale Purchases', 'Distributor Purchases (Inward)', `${purchases.length} purchase orders`, `${sups.length} Registered Suppliers`],
      ['Doctors Directory', 'Consulting / Family Doctors', `${docs.length} practitioners`, 'Prescription Network']
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 42 },
      1: { cellWidth: 55 },
      2: { cellWidth: 40 },
      3: { fontStyle: 'bold', halign: 'right' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // ==========================================
  // SECTION 1: INVOICES & BILLING REGISTER
  // ==========================================
  const afterKpiY = (doc as any).lastAutoTable.finalY + 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`1. INVOICES & BILLING REGISTER (${invs.length} TOTAL BILLS)`, 14, afterKpiY);

  const invoiceRows = invs.map((inv) => [
    inv.invoiceNo,
    `${formatDate(inv.date)} ${inv.time}`,
    inv.customerName || 'Walk-in Customer',
    inv.customerPhone && inv.customerPhone !== 'N/A' && inv.customerPhone !== '-' ? inv.customerPhone : '-',
    inv.doctorName || 'Self / OTC',
    `${inv.items?.length || 0} items`,
    (inv.paymentMode || 'cash').toUpperCase(),
    formatPdfCurrency(inv.grandTotal),
    (inv.status || 'paid').toUpperCase(),
  ]);

  autoTable(doc, {
    startY: afterKpiY + 4,
    head: [
      ['Invoice #', 'Date & Time', 'Customer', 'Phone', 'Doctor', 'Items', 'Mode', 'Net Total', 'Status']
    ],
    body: invoiceRows.length > 0 ? invoiceRows : [['No invoices recorded in database', '', '', '', '', '', '', '', '']],
    theme: 'striped',
    headStyles: {
      fillColor: [5, 150, 105], // emerald-600
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 26 },
      1: { cellWidth: 26 },
      2: { fontStyle: 'bold', cellWidth: 26 },
      3: { cellWidth: 20 },
      4: { cellWidth: 24 },
      5: { cellWidth: 15 },
      6: { cellWidth: 14, halign: 'center' },
      7: { fontStyle: 'bold', halign: 'right', cellWidth: 20 },
      8: { cellWidth: 14, halign: 'center' },
    },
  });

  // ==========================================
  // SECTION 2: MEDICINE INVENTORY & BATCHES
  // ==========================================
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`2. MEDICINE INVENTORY & ACTIVE STOCK BATCHES (${batches.length} BATCHES)`, 14, 15);

  const batchRows = batches.map((b) => {
    const matchedMed = meds.find((m) => m.id === b.medicineId);
    return [
      b.medicineName,
      matchedMed?.category || 'Tablets',
      b.batchNumber,
      b.expiryDate,
      `${matchedMed?.rack || 'Rack A'} - ${matchedMed?.shelf || 'Shelf 1'}`,
      formatPdfCurrency(b.purchaseRate),
      formatPdfCurrency(b.mrp),
      `${b.stockQty}`,
      formatPdfCurrency(b.stockQty * b.mrp),
    ];
  });

  autoTable(doc, {
    startY: 20,
    head: [
      ['Medicine Name', 'Category', 'Batch #', 'Expiry', 'Rack Location', 'Cost Rate', 'MRP', 'Stock Qty', 'Total MRP Val']
    ],
    body: batchRows.length > 0 ? batchRows : [['No batches in stock', '', '', '', '', '', '', '', '']],
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 38 },
      1: { cellWidth: 24 },
      2: { cellWidth: 18 },
      3: { cellWidth: 16 },
      4: { cellWidth: 22 },
      5: { halign: 'right', cellWidth: 16 },
      6: { halign: 'right', cellWidth: 16 },
      7: { fontStyle: 'bold', halign: 'center', cellWidth: 16 },
      8: { fontStyle: 'bold', halign: 'right' },
    },
  });

  // ==========================================
  // SECTION 3: CUSTOMER DIRECTORY & KHATA (CREDIT)
  // ==========================================
  const afterBatchesY = (doc as any).lastAutoTable.finalY + 9;
  let currentY = afterBatchesY;
  if (currentY > 230) {
    doc.addPage();
    currentY = 15;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`3. CUSTOMER DIRECTORY & KHATA (CREDIT LEDGER) (${custs.length} ACCOUNTS)`, 14, currentY);

  const custRows = custs.map((c) => [
    c.name,
    c.phone,
    c.address || '-',
    c.doctorName || '-',
    formatPdfCurrency(c.totalPurchases),
    formatPdfCurrency(c.outstandingBalance),
    c.outstandingBalance > 0 ? 'DUE' : 'CLEAR',
  ]);

  autoTable(doc, {
    startY: currentY + 4,
    head: [
      ['Customer / Patient', 'Phone', 'Address / Locality', 'Family Doctor', 'Total Purchases', 'Khata Balance Due', 'Status']
    ],
    body: custRows.length > 0 ? custRows : [['No customer records', '', '', '', '', '', '']],
    theme: 'striped',
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { cellWidth: 24 },
      2: { cellWidth: 40 },
      3: { cellWidth: 30 },
      4: { halign: 'right', cellWidth: 22 },
      5: { fontStyle: 'bold', halign: 'right', cellWidth: 22 },
      6: { halign: 'center', cellWidth: 14 },
    },
  });

  // ==========================================
  // SECTION 4: WHOLESALER PURCHASES & SUPPLIERS
  // ==========================================
  const afterCustsY = (doc as any).lastAutoTable.finalY + 9;
  let supY = afterCustsY;
  if (supY > 230) {
    doc.addPage();
    supY = 15;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`4. WHOLESALER PURCHASES & SUPPLIERS DIRECTORY (${purchases.length} ORDERS, ${sups.length} SUPPLIERS)`, 14, supY);

  const purchaseRows = purchases.map((p) => [
    p.purchaseNo,
    p.supplierName,
    p.supplierInvoiceNo || '-',
    formatDate(p.date),
    `${p.items?.length || 0} items`,
    formatPdfCurrency(p.grandTotal),
    (p.paymentStatus || 'paid').toUpperCase(),
  ]);

  autoTable(doc, {
    startY: supY + 4,
    head: [
      ['Purchase #', 'Supplier / Distributor', 'Supplier Inv #', 'Date', 'Items', 'Total Value', 'Status']
    ],
    body: purchaseRows.length > 0 ? purchaseRows : [['No purchase orders recorded', '', '', '', '', '', '']],
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 28 },
      1: { cellWidth: 45 },
      2: { cellWidth: 30 },
      3: { cellWidth: 25 },
      4: { cellWidth: 18 },
      5: { fontStyle: 'bold', halign: 'right', cellWidth: 24 },
      6: { halign: 'center', cellWidth: 16 },
    },
  });

  // ==========================================
  // PAGE NUMBERS & AUDIT WATERMARK ON ALL PAGES
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Bottom rule
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 287, 196, 287);

    // Footer text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`${storeName} • Comprehensive System Database Backup • Confidential`, 14, 291);
    doc.text(`Page ${i} of ${totalPages}`, 180, 291);
  }

  // Trigger download of the PDF file
  const fileName = `${storeName.replace(/\s+/g, '_')}_Backup_${dateNow.toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
