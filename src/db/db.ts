import Dexie, { type Table } from 'dexie';
import {
  Medicine,
  Batch,
  Customer,
  Doctor,
  Supplier,
  Invoice,
  PurchaseOrder,
  CustomerPayment,
  StoreSettings,
  HeldBill,
  Workspace,
} from '../types';
import {
  initialMedicines,
  initialBatches,
  initialCustomers,
  initialDoctors,
  initialSuppliers,
  initialStoreSettings,
  initialWorkspaces,
  initialMultiIndustryProducts,
  initialMultiIndustryBatches,
  initialMultiIndustrySuppliers,
} from './seedData';

export class PharmaDatabase extends Dexie {
  medicines!: Table<Medicine, string>;
  batches!: Table<Batch, string>;
  customers!: Table<Customer, string>;
  doctors!: Table<Doctor, string>;
  suppliers!: Table<Supplier, string>;
  invoices!: Table<Invoice, string>;
  purchases!: Table<PurchaseOrder, string>;
  customerPayments!: Table<CustomerPayment, string>;
  settings!: Table<StoreSettings, number>;
  heldBills!: Table<HeldBill, string>;
  workspaces!: Table<Workspace, string>;

  constructor() {
    super('PharmaCareDB');
    this.version(1).stores({
      medicines: 'id, name, genericName, category, rack, shelf, hsnCode, schedule',
      batches: 'id, medicineId, batchNumber, expiryDate, stockQty, barcode',
      customers: 'id, name, phone, outstandingBalance',
      doctors: 'id, name, regNo',
      suppliers: 'id, name, phone, gstin',
      invoices: 'id, invoiceNo, date, customerId, paymentMode, grandTotal, createdYearMonth',
      purchases: 'id, purchaseNo, supplierId, date',
      customerPayments: 'id, customerId, date',
      settings: 'id',
      heldBills: 'id, customerPhone',
    });

    this.version(2).stores({
      medicines: 'id, name, genericName, category, rack, shelf, hsnCode, schedule, barcode',
      batches: 'id, medicineId, batchNumber, expiryDate, stockQty, barcode',
    });

    this.version(3).stores({
      workspaces: 'id, slug, industry',
      medicines: 'id, workspaceId, name, genericName, category, rack, shelf, hsnCode, schedule, barcode',
      batches: 'id, workspaceId, medicineId, batchNumber, expiryDate, stockQty, barcode',
      customers: 'id, workspaceId, name, phone, outstandingBalance',
      doctors: 'id, workspaceId, name, regNo',
      suppliers: 'id, workspaceId, name, phone, gstin',
      invoices: 'id, workspaceId, invoiceNo, date, customerId, paymentMode, grandTotal, createdYearMonth',
      purchases: 'id, workspaceId, purchaseNo, supplierId, date',
      customerPayments: 'id, workspaceId, customerId, date',
      heldBills: 'id, workspaceId, customerPhone',
    });
  }
}

export const db = new PharmaDatabase();

// Initialize sample data on first run
export async function initializeDatabase() {
  // 1. Initialize Workspaces
  const workspaceCount = await db.workspaces.count();
  if (workspaceCount === 0) {
    await db.workspaces.bulkAdd(initialWorkspaces);
  }

  // 2. Initialize Pharmacy Base Medicines with workspaceId
  const medicineCount = await db.medicines.count();
  if (medicineCount === 0) {
    const pharmaMeds = initialMedicines.map((m) => ({ ...m, workspaceId: 'ws_healthplus' }));
    const pharmaBatches = initialBatches.map((b) => ({ ...b, workspaceId: 'ws_healthplus' }));
    const pharmaCusts = initialCustomers.map((c) => ({ ...c, workspaceId: 'ws_healthplus' }));
    const pharmaDocs = initialDoctors.map((d) => ({ ...d, workspaceId: 'ws_healthplus' }));
    const pharmaSups = initialSuppliers.map((s) => ({ ...s, workspaceId: 'ws_healthplus' }));

    await db.medicines.bulkAdd(pharmaMeds);
    await db.batches.bulkAdd(pharmaBatches);
    await db.customers.bulkAdd(pharmaCusts);
    await db.doctors.bulkAdd(pharmaDocs);
    await db.suppliers.bulkAdd([...pharmaSups, ...initialMultiIndustrySuppliers]);
    await db.settings.put({ ...initialStoreSettings, id: 1, workspaceId: 'ws_healthplus' });

    // Also populate multi-industry products for demonstration
    await db.medicines.bulkAdd(initialMultiIndustryProducts);
    await db.batches.bulkAdd(initialMultiIndustryBatches);
    await db.suppliers.bulkAdd(initialMultiIndustrySuppliers);
  } else {
    // Migration: ensure any medicines or batches without workspaceId get 'ws_healthplus'
    await db.medicines.toCollection().modify((m) => {
      if (!m.workspaceId) m.workspaceId = 'ws_healthplus';
    });
    await db.batches.toCollection().modify((b) => {
      if (!b.workspaceId) b.workspaceId = 'ws_healthplus';
    });
    await db.customers.toCollection().modify((c) => {
      if (!c.workspaceId) c.workspaceId = 'ws_healthplus';
    });
    await db.suppliers.toCollection().modify((s) => {
      if (!s.workspaceId) s.workspaceId = 'ws_healthplus';
    });
    await db.invoices.toCollection().modify((inv) => {
      if (!inv.workspaceId) inv.workspaceId = 'ws_healthplus';
    });

    // Ensure all existing workspaces have their industry color theme assigned
    await db.workspaces.toCollection().modify((ws) => {
      if (!ws.theme) {
        if (ws.industry === 'grocery') ws.theme = 'amber';
        else if (ws.industry === 'electronics') ws.theme = 'blue';
        else if (ws.industry === 'clothing') ws.theme = 'purple';
        else ws.theme = 'emerald';
      }
    });

    // Check if multi-industry products exist
    const hasFreshmart = await db.medicines.where('workspaceId').equals('ws_freshmart').first();
    if (!hasFreshmart) {
      await db.medicines.bulkAdd(initialMultiIndustryProducts);
      await db.batches.bulkAdd(initialMultiIndustryBatches);
    }

    // Check if multi-industry suppliers exist
    const hasFreshmartSuppliers = await db.suppliers.where('workspaceId').equals('ws_freshmart').first();
    if (!hasFreshmartSuppliers) {
      await db.suppliers.bulkAdd(initialMultiIndustrySuppliers);
    }
  }
}

// Helper to export full DB as JSON
export async function exportDatabaseToJson(): Promise<string> {
  const data = {
    exportDate: new Date().toISOString(),
    version: 3,
    workspaces: await db.workspaces.toArray(),
    storeSettings: await db.settings.toArray(),
    medicines: await db.medicines.toArray(),
    batches: await db.batches.toArray(),
    customers: await db.customers.toArray(),
    doctors: await db.doctors.toArray(),
    suppliers: await db.suppliers.toArray(),
    invoices: await db.invoices.toArray(),
    purchases: await db.purchases.toArray(),
    customerPayments: await db.customerPayments.toArray(),
  };
  return JSON.stringify(data, null, 2);
}

// Helper to restore DB from JSON
export async function restoreDatabaseFromJson(jsonContent: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonContent);
    await db.transaction('rw', [
      db.workspaces,
      db.settings,
      db.medicines,
      db.batches,
      db.customers,
      db.doctors,
      db.suppliers,
      db.invoices,
      db.purchases,
      db.customerPayments,
      db.heldBills,
    ], async () => {
      await db.workspaces.clear();
      await db.settings.clear();
      await db.medicines.clear();
      await db.batches.clear();
      await db.customers.clear();
      await db.doctors.clear();
      await db.suppliers.clear();
      await db.invoices.clear();
      await db.purchases.clear();
      await db.customerPayments.clear();
      await db.heldBills.clear();

      if (data.workspaces?.length) await db.workspaces.bulkAdd(data.workspaces);
      if (data.storeSettings?.length) await db.settings.bulkAdd(data.storeSettings);
      if (data.medicines?.length) await db.medicines.bulkAdd(data.medicines);
      if (data.batches?.length) await db.batches.bulkAdd(data.batches);
      if (data.customers?.length) await db.customers.bulkAdd(data.customers);
      if (data.doctors?.length) await db.doctors.bulkAdd(data.doctors);
      if (data.suppliers?.length) await db.suppliers.bulkAdd(data.suppliers);
      if (data.invoices?.length) await db.invoices.bulkAdd(data.invoices);
      if (data.purchases?.length) await db.purchases.bulkAdd(data.purchases);
      if (data.customerPayments?.length) await db.customerPayments.bulkAdd(data.customerPayments);
    });
    return true;
  } catch (err) {
    console.error('Failed to restore database:', err);
    return false;
  }
}

// Reset database to initial sample data
export async function resetDatabaseToDefault() {
  await db.transaction('rw', [
    db.workspaces,
    db.settings,
    db.medicines,
    db.batches,
    db.customers,
    db.doctors,
    db.suppliers,
    db.invoices,
    db.purchases,
    db.customerPayments,
    db.heldBills,
  ], async () => {
    await db.workspaces.clear();
    await db.settings.clear();
    await db.medicines.clear();
    await db.batches.clear();
    await db.customers.clear();
    await db.doctors.clear();
    await db.suppliers.clear();
    await db.invoices.clear();
    await db.purchases.clear();
    await db.customerPayments.clear();
    await db.heldBills.clear();

    await db.workspaces.bulkAdd(initialWorkspaces);
    const pharmaMeds = initialMedicines.map((m) => ({ ...m, workspaceId: 'ws_healthplus' }));
    const pharmaBatches = initialBatches.map((b) => ({ ...b, workspaceId: 'ws_healthplus' }));
    const pharmaCusts = initialCustomers.map((c) => ({ ...c, workspaceId: 'ws_healthplus' }));
    const pharmaDocs = initialDoctors.map((d) => ({ ...d, workspaceId: 'ws_healthplus' }));
    const pharmaSups = initialSuppliers.map((s) => ({ ...s, workspaceId: 'ws_healthplus' }));

    await db.medicines.bulkAdd([...pharmaMeds, ...initialMultiIndustryProducts]);
    await db.batches.bulkAdd([...pharmaBatches, ...initialMultiIndustryBatches]);
    await db.customers.bulkAdd(pharmaCusts);
    await db.doctors.bulkAdd(pharmaDocs);
    await db.suppliers.bulkAdd([...pharmaSups, ...initialMultiIndustrySuppliers]);
    await db.settings.put({ ...initialStoreSettings, id: 1, workspaceId: 'ws_healthplus' });
  });
}
