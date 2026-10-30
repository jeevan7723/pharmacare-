export type ScheduleType = 'OTC' | 'Schedule H' | 'Schedule H1' | 'Schedule X' | 'Narcotic';

export type MedicineCategory = 
  | 'Tablets'
  | 'Capsules'
  | 'Syrups & Suspensions'
  | 'Injections'
  | 'Ointments & Creams'
  | 'Drops (Eye/Ear)'
  | 'Inhalers & Respiratory'
  | 'Medical Devices & First Aid'
  | 'Nutraceuticals & Vitamins'
  | 'Baby Care'
  | 'Personal Care';

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  manufacturer: string;
  category: MedicineCategory;
  rack: string;          // e.g. "Rack A"
  shelf: string;         // e.g. "Shelf 2"
  hsnCode: string;       // e.g. "30049099"
  schedule: ScheduleType;
  unit: string;          // "Strip", "Bottle", "Tube", "Box", "Vial", "Piece"
  packSize: number;      // e.g. 10 tablets per strip
  minStockAlert: number; // e.g. 15
  defaultGstPercent: number; // 0, 5, 12, 18
  description?: string;
  createdAt: string;
}

export interface Batch {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;    // YYYY-MM
  purchaseRate: number;  // Cost price per strip/unit (excl. tax)
  mrp: number;           // Maximum Retail Price
  saleRate: number;      // Selling rate (usually equal or discounted from MRP)
  stockQty: number;      // Available units/strips
  barcode?: string;
  supplierId?: string;
  supplierName?: string;
  createdAt: string;
}

export interface CartItem {
  medicineId: string;
  batchId: string;
  medicineName: string;
  genericName: string;
  manufacturer: string;
  category: MedicineCategory;
  rackLocation: string;
  schedule: ScheduleType;
  batchNumber: string;
  expiryDate: string;
  unit: string;
  packSize: number;
  availableStock: number;
  qty: number;
  freeQty: number;
  mrp: number;
  unitRate: number;       // Base rate charged
  discountPercent: number;// Line item discount %
  gstPercent: number;     // 0, 5, 12, 18
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  doctorName?: string;
  outstandingBalance: number;
  totalPurchases: number;
  createdAt: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialization?: string;
  clinic?: string;
  regNo?: string;
  phone?: string;
  address?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  dlNo?: string;
  balance: number;
}

export type PaymentMode = 'cash' | 'upi' | 'card' | 'credit' | 'split';

export interface Invoice {
  id: string;
  invoiceNo: string;
  date: string;          // ISO date string
  time: string;          // HH:mm format
  customerId?: string;
  customerName: string;
  customerPhone: string;
  doctorName?: string;
  doctorRegNo?: string;
  items: CartItem[];
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalGst: number;
  cgstAmount: number;
  sgstAmount: number;
  roundOff: number;
  grandTotal: number;
  paymentMode: PaymentMode;
  paidAmount: number;
  changeDue: number;
  creditAmount: number;
  status: 'paid' | 'credit' | 'cancelled';
  notes?: string;
  createdYearMonth: string; // "2026-10" for fast report filtering
}

export interface PurchaseItem {
  medicineId: string;
  medicineName: string;
  genericName: string;
  batchNumber: string;
  expiryDate: string;
  qty: number;
  freeQty: number;
  purchaseRate: number;
  mrp: number;
  saleRate: number;
  gstPercent: number;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
}

export interface PurchaseOrder {
  id: string;
  purchaseNo: string;
  supplierId: string;
  supplierName: string;
  supplierInvoiceNo: string;
  date: string;
  items: PurchaseItem[];
  subtotal: number;
  totalGst: number;
  grandTotal: number;
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  paidAmount: number;
  notes?: string;
  createdAt: string;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  amount: number;
  paymentMode: 'cash' | 'upi' | 'card';
  referenceNo?: string;
  notes?: string;
}

export interface StoreSettings {
  id?: number;
  storeName: string;
  tagline: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  dlNo1: string; // Drug License Form 20B
  dlNo2: string; // Drug License Form 21B
  gstin: string;
  fssaiNo?: string;
  upiId: string; // e.g. "pharmacy@upi"
  upiName: string;
  currencySymbol: string;
  invoiceFooterTerms: string;
  defaultGstRate: number;
  printFormat: 'thermal-80mm' | 'a4-tax-invoice' | 'a5';
  autoPrintOnSave: boolean;
}

export interface HeldBill {
  id: string;
  holdTime: string;
  customerName: string;
  customerPhone: string;
  doctorName?: string;
  items: CartItem[];
  note?: string;
}

