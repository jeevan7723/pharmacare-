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
} from '../types';
import {
  initialMedicines,
  initialBatches,
  initialCustomers,
  initialDoctors,
  initialSuppliers,
  initialStoreSettings,
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
  }
}

export const db = new PharmaDatabase();

// Initialize sample data on first run
export async function initializeDatabase() {
  const medicineCount = await db.medicines.count();
  if (medicineCount === 0) {
    await db.medicines.bulkAdd(initialMedicines);
    await db.batches.bulkAdd(initialBatches);
    await db.customers.bulkAdd(initialCustomers);
    await db.doctors.bulkAdd(initialDoctors);
    await db.suppliers.bulkAdd(initialSuppliers);
    await db.settings.put({ ...initialStoreSettings, id: 1 });
  }
}

// Helper to export full DB as JSON
export async function exportDatabaseToJson(): Promise<string> {
  const data = {
    exportDate: new Date().toISOString(),
    version: 1,
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

    await db.medicines.bulkAdd(initialMedicines);
    await db.batches.bulkAdd(initialBatches);
    await db.customers.bulkAdd(initialCustomers);
    await db.doctors.bulkAdd(initialDoctors);
    await db.suppliers.bulkAdd(initialSuppliers);
    await db.settings.put({ ...initialStoreSettings, id: 1 });
  });
}

