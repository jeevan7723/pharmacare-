export type IndustryType = 'pharmacy' | 'grocery' | 'electronics' | 'clothing' | 'general';

export type CompanyTheme = 'emerald' | 'amber' | 'blue' | 'purple' | 'rose' | 'cyan';

export type LicenseStatus = 'active' | 'trial' | 'suspended' | 'expired';

export type PlanTier = 'starter' | 'pro' | 'enterprise';

export interface WorkspaceFeatures {
  enableBatchAndExpiry: boolean;     // True for Pharmacy (FEFO, expiry alerts)
  enableDoctorPrescription: boolean; // True for Pharmacy / Clinics
  enableCustomerKhata: boolean;      // True for neighborhood retail credit
  enableBarcodeScanner: boolean;     // High-speed barcode/SKU checkout
  enableSerialTracking: boolean;     // Serial/IMEI tracking for Electronics
  enableRacksAndShelves: boolean;    // Physical shelf/rack locator
  enableDiscounts: boolean;          // Line item and bill discount
  enableWholesalePurchase: boolean;  // Inward stock tracking
}

export interface WorkspaceLicense {
  status: LicenseStatus;
  plan: PlanTier;
  validUntil: string;                // ISO date string e.g. "2027-12-31"
  maxMonthlyBills: number;           // Quota limit (e.g. 5000 or -1 for unlimited)
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  licenseKey: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;                      // URL friendly slug
  industry: IndustryType;
  theme?: CompanyTheme;              // Custom branding color theme
  features: WorkspaceFeatures;
  license: WorkspaceLicense;
  settings: StoreSettings;
  createdAt: string;
  notes?: string;
}

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
  | 'Personal Care'
  | 'Food & Beverages'
  | 'Dairy & Bakery'
  | 'Snacks & Packaged Food'
  | 'Household & Cleaning'
  | 'Electronics & Gadgets'
  | 'Mobile Accessories'
  | 'Apparel & Fashion'
  | 'Footwear'
  | 'General Goods';

export interface Medicine {
  id: string;
  workspaceId?: string;  // Multi-tenant partition ID
  name: string;
  genericName: string;   // For non-pharma: Subtitle / Brand / Specification
  manufacturer: string;  // Brand / Manufacturer / Vendor
  category: MedicineCategory | string;
  rack: string;          // Shelf / Aisle / Rack
  shelf: string;         // Shelf position
  hsnCode: string;       // GST / Tax classification
  schedule: ScheduleType;
  unit: string;          // "Strip", "Bottle", "Piece", "Kg", "Litre", "Box", "Set"
  packSize: number;      // Pack count or multiplier
  minStockAlert: number;
  defaultGstPercent: number; // 0, 5, 12, 18, 28
  description?: string;
  mrp?: number;          // Default MRP
  saleRate?: number;     // Default Sale Price
  purchaseRate?: number; // Cost Price
  barcode?: string;      // EAN-13 / UPC / SKU Barcode
  brand?: string;        // Specific to electronics/fashion
  modelNumber?: string;  // Electronics model
  warrantyMonths?: number; // Warranty period in months
  serialNumber?: string; // Serial / IMEI number
  size?: string;         // S, M, L, XL, 32, 40 etc.
  color?: string;        // Red, Blue, Black etc.
  createdAt: string;
}

export interface Batch {
  id: string;
  workspaceId?: string;  // Multi-tenant partition ID
  medicineId: string;
  medicineName: string;
  batchNumber: string;   // Batch / Lot / Stock Code
  expiryDate: string;    // YYYY-MM
  purchaseRate: number;  // Cost price (excl. tax)
  mrp: number;           // Maximum Retail Price
  saleRate: number;      // Selling rate
  stockQty: number;      // Available units
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
  category: MedicineCategory | string;
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
  unitRate: number;
  discountPercent: number;
  gstPercent: number;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  barcode?: string;
  serialNumber?: string;
  warrantyMonths?: number;
}

export interface Customer {
  id: string;
  workspaceId?: string;
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
  workspaceId?: string;
  name: string;
  specialization?: string;
  clinic?: string;
  regNo?: string;
  phone?: string;
  address?: string;
}

export interface Supplier {
  id: string;
  workspaceId?: string;
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
  workspaceId?: string;
  invoiceNo: string;
  date: string;
  time: string;
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
  createdYearMonth: string;
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
  barcode?: string;
}

export interface PurchaseOrder {
  id: string;
  workspaceId?: string;
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
  workspaceId?: string;
  customerId: string;
  customerName: string;
  date: string;
  amount: number;
  paymentMode: 'cash' | 'upi' | 'card' | 'split';
  referenceNo?: string;
  notes?: string;
}

export interface StoreSettings {
  id?: number;
  workspaceId?: string;
  storeName: string;
  tagline: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  dlNo1: string; // Drug License Form 20B (or Trade License)
  dlNo2: string; // Drug License Form 21B (or Shop Act No)
  gstin: string; // Tax ID / GSTIN / VAT
  fssaiNo?: string;
  upiId: string; // VPA
  upiName: string;
  currencySymbol: string;
  invoiceFooterTerms: string;
  defaultGstRate: number;
  printFormat: 'thermal-80mm' | 'a4-tax-invoice' | 'a5';
  autoPrintOnSave: boolean;
}

export interface HeldBill {
  id: string;
  workspaceId?: string;
  holdTime: string;
  customerName: string;
  customerPhone: string;
  doctorName?: string;
  items: CartItem[];
  note?: string;
}
