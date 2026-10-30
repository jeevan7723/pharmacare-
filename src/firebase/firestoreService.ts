import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { firestore } from './config';
import { db } from '../db/db';
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

export interface FirebaseSyncStatus {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}

// Check Firebase connection status (read-only verification without writing dummy documents)
export async function checkFirebaseConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    await getDoc(doc(firestore, 'settings', 'store_profile'));
    return { ok: true, message: 'Connected to Firebase Cloud Firestore (pharmacare-1d3a2)' };
  } catch (err: any) {
    console.error('Firebase connection test error:', err);
    return { ok: false, message: err?.message || 'Failed to connect to Firebase' };
  }
}

// Deep sanitizer to strip undefined properties that Firestore rejects
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        result[key] = sanitizeForFirestore(value);
      }
    }
    return result as T;
  }
  return data;
}

// ================= SYNC HELPERS (Save directly to Cloud Firestore) =================

export async function syncMedicineToCloud(med: Medicine) {
  try {
    await setDoc(doc(firestore, 'medicines', med.id), sanitizeForFirestore(med));
  } catch (err) {
    console.warn('Failed to sync medicine to cloud:', err);
  }
}

export async function deleteMedicineFromCloud(id: string) {
  try {
    await deleteDoc(doc(firestore, 'medicines', id));
  } catch (err) {
    console.warn('Failed to delete medicine from cloud:', err);
  }
}

export async function syncBatchToCloud(batch: Batch) {
  try {
    await setDoc(doc(firestore, 'batches', batch.id), sanitizeForFirestore(batch));
  } catch (err) {
    console.warn('Failed to sync batch to cloud:', err);
  }
}

export async function deleteBatchFromCloud(id: string) {
  try {
    await deleteDoc(doc(firestore, 'batches', id));
  } catch (err) {
    console.warn('Failed to delete batch from cloud:', err);
  }
}

export async function syncCustomerToCloud(cust: Customer) {
  try {
    await setDoc(doc(firestore, 'customers', cust.id), sanitizeForFirestore(cust));
  } catch (err) {
    console.warn('Failed to sync customer to cloud:', err);
  }
}

export async function deleteCustomerFromCloud(id: string) {
  try {
    await deleteDoc(doc(firestore, 'customers', id));
  } catch (err) {
    console.warn('Failed to delete customer from cloud:', err);
  }
}

export async function syncDoctorToCloud(docData: Doctor) {
  try {
    await setDoc(doc(firestore, 'doctors', docData.id), sanitizeForFirestore(docData));
  } catch (err) {
    console.warn('Failed to sync doctor to cloud:', err);
  }
}

export async function deleteDoctorFromCloud(id: string) {
  try {
    await deleteDoc(doc(firestore, 'doctors', id));
  } catch (err) {
    console.warn('Failed to delete doctor from cloud:', err);
  }
}

export async function syncSupplierToCloud(sup: Supplier) {
  try {
    await setDoc(doc(firestore, 'suppliers', sup.id), sanitizeForFirestore(sup));
  } catch (err) {
    console.warn('Failed to sync supplier to cloud:', err);
  }
}

export async function deleteSupplierFromCloud(id: string) {
  try {
    await deleteDoc(doc(firestore, 'suppliers', id));
  } catch (err) {
    console.warn('Failed to delete supplier from cloud:', err);
  }
}

export async function syncInvoiceToCloud(invoice: Invoice) {
  try {
    const cleaned = sanitizeForFirestore(invoice);
    await setDoc(doc(firestore, 'invoices', invoice.id), cleaned);
    console.log(`[Firebase Cloud] Invoice ${invoice.invoiceNo} successfully stored in Firebase!`);
  } catch (err) {
    console.warn('Failed to sync invoice to cloud:', err);
  }
}

export async function deleteInvoiceFromCloud(id: string) {
  try {
    await deleteDoc(doc(firestore, 'invoices', id));
  } catch (err) {
    console.warn('Failed to delete invoice from cloud:', err);
  }
}

export async function syncCustomerPaymentToCloud(payment: CustomerPayment) {
  try {
    const cleaned = sanitizeForFirestore(payment);
    await setDoc(doc(firestore, 'customerPayments', payment.id), cleaned);
    console.log(`[Firebase Cloud] Payment ${payment.id} successfully stored in Firebase!`);
  } catch (err) {
    console.warn('Failed to sync payment to cloud:', err);
  }
}

export async function deleteCustomerPaymentFromCloud(id: string) {
  try {
    await deleteDoc(doc(firestore, 'customerPayments', id));
  } catch (err) {
    console.warn('Failed to delete payment from cloud:', err);
  }
}

export async function syncPurchaseToCloud(purchase: PurchaseOrder) {
  try {
    await setDoc(doc(firestore, 'purchases', purchase.id), sanitizeForFirestore(purchase));
  } catch (err) {
    console.warn('Failed to sync purchase to cloud:', err);
  }
}

export async function deletePurchaseFromCloud(id: string) {
  try {
    await deleteDoc(doc(firestore, 'purchases', id));
  } catch (err) {
    console.warn('Failed to delete purchase from cloud:', err);
  }
}

export async function syncHeldBillToCloud(bill: HeldBill) {
  try {
    await setDoc(doc(firestore, 'heldBills', bill.id), sanitizeForFirestore(bill));
  } catch (err) {
    console.warn('Failed to sync held bill to cloud:', err);
  }
}

export async function deleteHeldBillFromCloud(id: string) {
  try {
    await deleteDoc(doc(firestore, 'heldBills', id));
  } catch (err) {
    console.warn('Failed to delete held bill from cloud:', err);
  }
}

export async function syncSettingsToCloud(settings: StoreSettings) {
  try {
    await setDoc(doc(firestore, 'settings', 'store_profile'), sanitizeForFirestore(settings));
  } catch (err) {
    console.warn('Failed to sync settings to cloud:', err);
  }
}

// ================= MASS CLOUD SYNC & RESTORE =================

/**
 * Sync ALL invoices, billing history, and payment transactions to Cloud Firestore
 */
export async function syncAllBillingAndPaymentsToCloud(): Promise<{
  success: boolean;
  invoicesCount: number;
  paymentsCount: number;
  customersCount: number;
  message: string;
}> {
  try {
    const invs = await db.invoices.toArray();
    const payments = await db.customerPayments.toArray();
    const custs = await db.customers.toArray();

    let batch = writeBatch(firestore);
    let count = 0;

    const commitBatchIfNeeded = async () => {
      count++;
      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(firestore);
        count = 0;
      }
    };

    // 1. Sync Invoices / Bills
    for (const inv of invs) {
      batch.set(doc(firestore, 'invoices', inv.id), sanitizeForFirestore(inv));
      await commitBatchIfNeeded();
    }

    // 2. Sync Customer Payments
    for (const p of payments) {
      batch.set(doc(firestore, 'customerPayments', p.id), sanitizeForFirestore(p));
      await commitBatchIfNeeded();
    }

    // 3. Sync Customer Profiles & Balances
    for (const c of custs) {
      batch.set(doc(firestore, 'customers', c.id), sanitizeForFirestore(c));
      await commitBatchIfNeeded();
    }

    if (count > 0) {
      await batch.commit();
    }

    const msg = `Firebase Cloud updated: ${invs.length} bills, ${payments.length} payment receipts, and ${custs.length} customers synced!`;
    console.log('[Firebase Cloud]', msg);
    return {
      success: true,
      invoicesCount: invs.length,
      paymentsCount: payments.length,
      customersCount: custs.length,
      message: msg,
    };
  } catch (err: any) {
    console.error('Error syncing billing & payments to Firebase:', err);
    return {
      success: false,
      invoicesCount: 0,
      paymentsCount: 0,
      customersCount: 0,
      message: err?.message || 'Failed to sync billing data to Firebase Cloud',
    };
  }
}

/**
 * Upload all local database tables to Cloud Firestore (initial seeding / full push)
 */
export async function uploadLocalDatabaseToCloud(): Promise<{ success: boolean; message: string }> {
  try {
    const meds = await db.medicines.toArray();
    const batches = await db.batches.toArray();
    const custs = await db.customers.toArray();
    const docs = await db.doctors.toArray();
    const sups = await db.suppliers.toArray();
    const invs = await db.invoices.toArray();
    const purchases = await db.purchases.toArray();
    const payments = await db.customerPayments.toArray();
    const settings = await db.settings.get(1);

    // Batch writes for high speed
    let batch = writeBatch(firestore);
    let count = 0;

    const commitBatchIfNeeded = async () => {
      count++;
      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(firestore);
        count = 0;
      }
    };

    // Store settings
    if (settings) {
      batch.set(doc(firestore, 'settings', 'store_profile'), sanitizeForFirestore(settings));
      await commitBatchIfNeeded();
    }

    // Medicines
    for (const m of meds) {
      batch.set(doc(firestore, 'medicines', m.id), sanitizeForFirestore(m));
      await commitBatchIfNeeded();
    }

    // Batches
    for (const b of batches) {
      batch.set(doc(firestore, 'batches', b.id), sanitizeForFirestore(b));
      await commitBatchIfNeeded();
    }

    // Customers
    for (const c of custs) {
      batch.set(doc(firestore, 'customers', c.id), sanitizeForFirestore(c));
      await commitBatchIfNeeded();
    }

    // Doctors
    for (const d of docs) {
      batch.set(doc(firestore, 'doctors', d.id), sanitizeForFirestore(d));
      await commitBatchIfNeeded();
    }

    // Suppliers
    for (const s of sups) {
      batch.set(doc(firestore, 'suppliers', s.id), sanitizeForFirestore(s));
      await commitBatchIfNeeded();
    }

    // Invoices
    for (const inv of invs) {
      batch.set(doc(firestore, 'invoices', inv.id), sanitizeForFirestore(inv));
      await commitBatchIfNeeded();
    }

    // Purchases
    for (const p of purchases) {
      batch.set(doc(firestore, 'purchases', p.id), sanitizeForFirestore(p));
      await commitBatchIfNeeded();
    }

    // Payments
    for (const p of payments) {
      batch.set(doc(firestore, 'customerPayments', p.id), sanitizeForFirestore(p));
      await commitBatchIfNeeded();
    }

    if (count > 0) {
      await batch.commit();
    }

    return {
      success: true,
      message: `Successfully uploaded ${meds.length} medicines, ${batches.length} batches, ${invs.length} invoices, and store settings to Firebase Cloud!`,
    };
  } catch (err: any) {
    console.error('Error uploading to cloud:', err);
    return { success: false, message: err?.message || 'Failed to upload to Firebase Cloud' };
  }
}

/**
 * Fetch all data from Cloud Firestore and populate local database (pull from cloud)
 */
export async function downloadCloudDatabaseToLocal(): Promise<{ success: boolean; message: string }> {
  try {
    const medsSnap = await getDocs(collection(firestore, 'medicines'));
    const batchesSnap = await getDocs(collection(firestore, 'batches'));
    const custsSnap = await getDocs(collection(firestore, 'customers'));
    const docsSnap = await getDocs(collection(firestore, 'doctors'));
    const supsSnap = await getDocs(collection(firestore, 'suppliers'));
    const invsSnap = await getDocs(collection(firestore, 'invoices'));
    const purchasesSnap = await getDocs(collection(firestore, 'purchases'));
    const paymentsSnap = await getDocs(collection(firestore, 'customerPayments'));
    const settingsDoc = await getDoc(doc(firestore, 'settings', 'store_profile'));

    const meds: Medicine[] = [];
    medsSnap.forEach((d) => meds.push(d.data() as Medicine));

    const batches: Batch[] = [];
    batchesSnap.forEach((d) => batches.push(d.data() as Batch));

    const custs: Customer[] = [];
    custsSnap.forEach((d) => custs.push(d.data() as Customer));

    const docs: Doctor[] = [];
    docsSnap.forEach((d) => docs.push(d.data() as Doctor));

    const sups: Supplier[] = [];
    supsSnap.forEach((d) => sups.push(d.data() as Supplier));

    const invs: Invoice[] = [];
    invsSnap.forEach((d) => invs.push(d.data() as Invoice));

    const purchases: PurchaseOrder[] = [];
    purchasesSnap.forEach((d) => purchases.push(d.data() as PurchaseOrder));

    const payments: CustomerPayment[] = [];
    paymentsSnap.forEach((d) => payments.push(d.data() as CustomerPayment));

    if (meds.length === 0 && batches.length === 0) {
      return {
        success: false,
        message: 'No medicines or batches found in Firebase Cloud. Try clicking "Upload Local Data to Firebase" first.',
      };
    }

    // Save into local Dexie
    await db.transaction('rw', [
      db.medicines,
      db.batches,
      db.customers,
      db.doctors,
      db.suppliers,
      db.invoices,
      db.purchases,
      db.customerPayments,
      db.settings,
    ], async () => {
      if (meds.length > 0) {
        await db.medicines.clear();
        await db.medicines.bulkAdd(meds);
      }
      if (batches.length > 0) {
        await db.batches.clear();
        await db.batches.bulkAdd(batches);
      }
      if (custs.length > 0) {
        await db.customers.clear();
        await db.customers.bulkAdd(custs);
      }
      if (docs.length > 0) {
        await db.doctors.clear();
        await db.doctors.bulkAdd(docs);
      }
      if (sups.length > 0) {
        await db.suppliers.clear();
        await db.suppliers.bulkAdd(sups);
      }
      if (invs.length > 0) {
        await db.invoices.clear();
        await db.invoices.bulkAdd(invs);
      }
      if (purchases.length > 0) {
        await db.purchases.clear();
        await db.purchases.bulkAdd(purchases);
      }
      if (payments.length > 0) {
        await db.customerPayments.clear();
        await db.customerPayments.bulkAdd(payments);
      }
      if (settingsDoc.exists()) {
        const s = settingsDoc.data() as StoreSettings;
        await db.settings.put({ ...s, id: 1 });
      }
    });

    return {
      success: true,
      message: `Downloaded ${meds.length} medicines, ${batches.length} batches, and ${invs.length} invoices from Firebase Cloud!`,
    };
  } catch (err: any) {
    console.error('Error downloading from cloud:', err);
    return { success: false, message: err?.message || 'Failed to download from Firebase Cloud' };
  }
}
