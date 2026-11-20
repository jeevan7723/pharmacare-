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
  Workspace,
} from '../types';

export interface FirebaseSyncStatus {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}

export let isSyncingFromCloud = false;
export function setSyncingFromCloud(val: boolean) {
  isSyncingFromCloud = val;
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
    const wsId = invoice.workspaceId || 'ws_healthplus';
    const cleanBillKey = invoice.invoiceNo ? invoice.invoiceNo.trim() : invoice.id;

    const payload = {
      ...cleaned,
      billNo: invoice.invoiceNo,
      collection: 'invoices',
      recordType: 'Retail Sales Tax Invoice',
      updatedAt: new Date().toISOString(),
    };

    // 1. Store in root 'invoices' collection using clean Bill No (e.g. INV-2026-0001) and id
    await setDoc(doc(firestore, 'invoices', cleanBillKey), payload);
    if (cleanBillKey !== invoice.id) {
      await setDoc(doc(firestore, 'invoices', invoice.id), payload);
    }

    // 2. Also store in root 'bills' and 'generated_bills' collections
    await setDoc(doc(firestore, 'bills', cleanBillKey), payload);
    await setDoc(doc(firestore, 'generated_bills', cleanBillKey), payload);
    if (cleanBillKey !== invoice.id) {
      await setDoc(doc(firestore, 'bills', invoice.id), payload);
      await setDoc(doc(firestore, 'generated_bills', invoice.id), payload);
    }

    // 3. Save to company's dedicated subcollections: 'companies/{wsId}/invoices' and 'companies/{wsId}/bills'
    await setDoc(doc(firestore, 'companies', wsId, 'invoices', cleanBillKey), payload);
    await setDoc(doc(firestore, 'companies', wsId, 'bills', cleanBillKey), payload);
    await setDoc(doc(firestore, 'companies', wsId, 'generated_bills', cleanBillKey), payload);

    // 4. Keep company document in companies/{workspaceId} and admin section updated
    syncCompanyFullBundle(wsId).catch(() => {});
    console.log(`[Firebase Cloud] Stored bill ${cleanBillKey} in collection 'invoices', 'bills', and 'generated_bills'!`);
  } catch (err) {
    console.warn('Failed to sync invoice/generated bill to cloud:', err);
  }
}

export const syncGeneratedBillToCloud = syncInvoiceToCloud;

export async function deleteInvoiceFromCloud(id: string, workspaceId?: string, invoiceNo?: string) {
  try {
    await deleteDoc(doc(firestore, 'invoices', id));
    await deleteDoc(doc(firestore, 'bills', id));
    await deleteDoc(doc(firestore, 'generated_bills', id));
    if (invoiceNo) {
      await deleteDoc(doc(firestore, 'invoices', invoiceNo));
      await deleteDoc(doc(firestore, 'bills', invoiceNo));
      await deleteDoc(doc(firestore, 'generated_bills', invoiceNo));
    }
    if (workspaceId) {
      await deleteDoc(doc(firestore, 'companies', workspaceId, 'invoices', id));
      await deleteDoc(doc(firestore, 'companies', workspaceId, 'bills', id));
      await deleteDoc(doc(firestore, 'companies', workspaceId, 'generated_bills', id));
      if (invoiceNo) {
        await deleteDoc(doc(firestore, 'companies', workspaceId, 'invoices', invoiceNo));
        await deleteDoc(doc(firestore, 'companies', workspaceId, 'bills', invoiceNo));
        await deleteDoc(doc(firestore, 'companies', workspaceId, 'generated_bills', invoiceNo));
      }
    }
  } catch (err) {
    console.warn('Failed to delete invoice from cloud:', err);
  }
}

export const deleteGeneratedBillFromCloud = deleteInvoiceFromCloud;

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

export async function syncWorkspaceToCloud(ws: Workspace) {
  try {
    await setDoc(doc(firestore, 'workspaces', ws.id), sanitizeForFirestore(ws));
    await syncCompanyFullBundle(ws.id);
    await syncAdminSectionToCloud();
    console.log(`[Firebase Cloud] Workspace/Company [${ws.id}] ${ws.name} stored in Firebase!`);
  } catch (err) {
    console.warn('Failed to sync workspace to cloud:', err);
  }
}

export async function deleteWorkspaceFromCloud(id: string) {
  try {
    await deleteDoc(doc(firestore, 'workspaces', id));
    await deleteDoc(doc(firestore, 'companies', id));
    await syncAdminSectionToCloud();
    console.log(`[Firebase Cloud] Workspace [${id}] removed from Firebase!`);
  } catch (err) {
    console.warn('Failed to delete workspace from cloud:', err);
  }
}

/**
 * Stores the complete data of a company directly inside its document:
 * Collection: "companies" -> Document: "{workspaceId}"
 * Contains: company info, license, settings, products, batches, suppliers, customers, invoices, and statistics.
 */
export async function syncCompanyFullBundle(workspaceId: string) {
  try {
    const ws = await db.workspaces.get(workspaceId);
    if (!ws) return;

    const meds = await db.medicines.where('workspaceId').equals(workspaceId).toArray();
    const batches = await db.batches.where('workspaceId').equals(workspaceId).toArray();
    const sups = await db.suppliers.where('workspaceId').equals(workspaceId).toArray();
    const custs = await db.customers.where('workspaceId').equals(workspaceId).toArray();
    const invs = await db.invoices.where('workspaceId').equals(workspaceId).toArray();
    const payments = await db.customerPayments.where('workspaceId').equals(workspaceId).toArray();
    const purchases = await db.purchases.where('workspaceId').equals(workspaceId).toArray();

    const totalRevenue = invs.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
    const totalStockUnits = batches.reduce((sum, b) => sum + (b.stockQty || 0), 0);
    const totalKhataDebt = custs.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);

    const companyData = {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      industry: ws.industry,
      theme: ws.theme || (ws.industry === 'grocery' ? 'amber' : ws.industry === 'electronics' ? 'blue' : ws.industry === 'clothing' ? 'purple' : 'emerald'),
      features: ws.features,
      license: ws.license,
      settings: ws.settings,
      createdAt: ws.createdAt,
      notes: ws.notes,
      updatedAt: new Date().toISOString(),

      stats: {
        totalProducts: meds.length,
        totalBatches: batches.length,
        totalStockUnits: totalStockUnits,
        totalSuppliers: sups.length,
        totalCustomers: custs.length,
        totalInvoices: invs.length,
        totalGeneratedBills: invs.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalKhataDebt: Math.round(totalKhataDebt * 100) / 100,
      },

      products: meds,
      batches: batches,
      suppliers: sups,
      customers: custs,
      invoices: invs,
      bills: invs,
      generated_bills: invs,
      purchases: purchases,
      customerPayments: payments,
    };

    // Save company document into `companies/{companyId}`
    await setDoc(doc(firestore, 'companies', ws.id), sanitizeForFirestore(companyData));

    // Also update company subcollections for deep browsing
    for (const prod of meds) {
      await setDoc(doc(firestore, 'companies', ws.id, 'products', prod.id), sanitizeForFirestore(prod));
    }
    for (const b of batches) {
      await setDoc(doc(firestore, 'companies', ws.id, 'batches', b.id), sanitizeForFirestore(b));
    }
    for (const s of sups) {
      await setDoc(doc(firestore, 'companies', ws.id, 'suppliers', s.id), sanitizeForFirestore(s));
    }
    for (const c of custs) {
      await setDoc(doc(firestore, 'companies', ws.id, 'customers', c.id), sanitizeForFirestore(c));
    }
    for (const inv of invs) {
      const billKey = inv.invoiceNo || inv.id;
      const invClean = sanitizeForFirestore({
        ...inv,
        billNo: inv.invoiceNo,
        collection: 'invoices',
        recordType: 'Retail Sales Tax Invoice',
      });
      await setDoc(doc(firestore, 'companies', ws.id, 'invoices', billKey), invClean);
      await setDoc(doc(firestore, 'companies', ws.id, 'bills', billKey), invClean);
      await setDoc(doc(firestore, 'companies', ws.id, 'generated_bills', billKey), invClean);
      await setDoc(doc(firestore, 'invoices', billKey), invClean);
      await setDoc(doc(firestore, 'bills', billKey), invClean);
      await setDoc(doc(firestore, 'generated_bills', billKey), invClean);
    }
  } catch (err) {
    console.warn(`Failed to sync company bundle for ${workspaceId}:`, err);
  }
}

/**
 * Stores the platform-wide Super Admin control and license registry
 * Collection: "admin" -> Documents: "master_control", "companies_registry"
 */
export async function syncAdminSectionToCloud() {
  try {
    const workspaces = await db.workspaces.toArray();
    const allInvs = await db.invoices.toArray();
    const allMeds = await db.medicines.toArray();
    const allBatches = await db.batches.toArray();
    const allSups = await db.suppliers.toArray();

    const adminOverview = {
      role: 'Super Admin Master Authority',
      platformName: 'PharmaCare Pro SaaS Multi-Tenant Billing Platform',
      masterPassword: 'jeevan@1234',
      masterUsername: 'jeevan',
      owner: 'Jeevan',
      lastSyncTimestamp: new Date().toISOString(),

      platformSummary: {
        totalClientCompanies: workspaces.length,
        activeCompanies: workspaces.filter((w) => w.license?.status === 'active').length,
        trialCompanies: workspaces.filter((w) => w.license?.status === 'trial').length,
        suspendedCompanies: workspaces.filter((w) => w.license?.status === 'suspended').length,
        totalCatalogProducts: allMeds.length,
        totalStockUnits: allBatches.reduce((s, b) => s + (b.stockQty || 0), 0),
        totalGlobalSuppliers: allSups.length,
        totalGlobalBills: allInvs.length,
        totalPlatformRevenue: Math.round(allInvs.reduce((s, i) => s + (i.grandTotal || 0), 0) * 100) / 100,
      },

      companiesRegistry: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        industry: w.industry,
        theme: w.theme,
        licenseKey: w.license?.licenseKey,
        plan: w.license?.plan,
        status: w.license?.status,
        validUntil: w.license?.validUntil,
        ownerName: w.license?.ownerName,
        ownerPhone: w.license?.ownerPhone,
        ownerEmail: w.license?.ownerEmail,
        gstin: w.settings?.gstin,
      })),

      securityControls: {
        passwordRequired: true,
        masterAuthMethod: 'PIN/Password Authentication',
        sessionTimeoutMinutes: 60,
        remoteKillSwitchEnabled: true,
      },
    };

    await setDoc(doc(firestore, 'admin', 'master_control'), sanitizeForFirestore(adminOverview));
    await setDoc(doc(firestore, 'admin', 'companies_registry'), sanitizeForFirestore({
      totalCompanies: workspaces.length,
      companies: adminOverview.companiesRegistry,
      updatedAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('Failed to sync admin section to cloud:', err);
  }
}

// ================= MASS CLOUD SYNC & RESTORE =================

/**
 * Ensures all paid invoices have corresponding CustomerPayment records in Dexie local DB.
 * Returns the array of newly created customer payments so they can be immediately synced to Firebase.
 */
export async function backfillInvoicePaymentsToLocalDb(): Promise<CustomerPayment[]> {
  try {
    const invs = await db.invoices.toArray();
    const existingPayments = await db.customerPayments.toArray();
    const existingIds = new Set(existingPayments.map((p) => p.id));
    const existingRefs = new Set(
      existingPayments.filter((p) => p.referenceNo).map((p) => p.referenceNo)
    );

    const newPayments: CustomerPayment[] = [];
    for (const inv of invs) {
      if (inv.paidAmount && inv.paidAmount > 0) {
        const pId = `pay-${inv.id}`;
        // If not already in customerPayments by ID or by invoice referenceNo
        if (!existingIds.has(pId) && !existingRefs.has(inv.invoiceNo)) {
          const payMode: 'cash' | 'upi' | 'card' | 'split' =
            inv.paymentMode === 'credit'
              ? 'cash'
              : (inv.paymentMode as any) || 'cash';

          const pmt: CustomerPayment = {
            id: pId,
            workspaceId: inv.workspaceId || 'ws_healthplus',
            customerId: inv.customerId || 'walk-in',
            customerName: inv.customerName || 'Walk-in Customer',
            date: inv.date || new Date().toISOString().split('T')[0],
            amount: inv.paidAmount,
            paymentMode: payMode,
            referenceNo: inv.invoiceNo,
            notes: `Invoice payment for ${inv.invoiceNo}`,
          };
          newPayments.push(pmt);
          existingIds.add(pId);
          if (inv.invoiceNo) existingRefs.add(inv.invoiceNo);
        }
      }
    }

    if (newPayments.length > 0) {
      await db.customerPayments.bulkPut(newPayments);
      console.log(`[Firebase Service] Backfilled ${newPayments.length} customer payments from invoices into local DB.`);
    }

    return newPayments;
  } catch (err) {
    console.warn('Error backfilling invoice payments:', err);
    return [];
  }
}

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
    // 0. Ensure all paid invoices are logged as CustomerPayments
    await backfillInvoicePaymentsToLocalDb();

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

    // 1. Sync Invoices / Bills (Both to 'invoices' and dedicated 'generated_bills')
    for (const inv of invs) {
      batch.set(doc(firestore, 'invoices', inv.id), sanitizeForFirestore(inv));
      batch.set(doc(firestore, 'generated_bills', inv.id), sanitizeForFirestore(inv));
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
    await backfillInvoicePaymentsToLocalDb();

    const workspaces = await db.workspaces.toArray();
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

    // Workspaces (Companies)
    for (const ws of workspaces) {
      batch.set(doc(firestore, 'workspaces', ws.id), sanitizeForFirestore(ws));
      await commitBatchIfNeeded();
    }

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

    // Invoices and Dedicated Generated Bills
    for (const inv of invs) {
      batch.set(doc(firestore, 'invoices', inv.id), sanitizeForFirestore(inv));
      batch.set(doc(firestore, 'generated_bills', inv.id), sanitizeForFirestore(inv));
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

    // Populate each company's document (companies/{companyId}) and admin control section (admin/master_control)
    for (const ws of workspaces) {
      await syncCompanyFullBundle(ws.id);
    }
    await syncAdminSectionToCloud();

    return {
      success: true,
      message: `Successfully uploaded ${workspaces.length} companies, ${meds.length} products, ${batches.length} batches, ${invs.length} invoices, and admin control section to Firebase Cloud!`,
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
    const workspacesSnap = await getDocs(collection(firestore, 'workspaces'));
    const medsSnap = await getDocs(collection(firestore, 'medicines'));
    const batchesSnap = await getDocs(collection(firestore, 'batches'));
    const custsSnap = await getDocs(collection(firestore, 'customers'));
    const docsSnap = await getDocs(collection(firestore, 'doctors'));
    const supsSnap = await getDocs(collection(firestore, 'suppliers'));
    let invsSnap = await getDocs(collection(firestore, 'generated_bills'));
    if (invsSnap.empty) {
      invsSnap = await getDocs(collection(firestore, 'invoices'));
    }
    const purchasesSnap = await getDocs(collection(firestore, 'purchases'));
    const paymentsSnap = await getDocs(collection(firestore, 'customerPayments'));
    const settingsDoc = await getDoc(doc(firestore, 'settings', 'store_profile'));

    const workspaces: Workspace[] = [];
    workspacesSnap.forEach((d) => workspaces.push(d.data() as Workspace));

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

    if (meds.length === 0 && batches.length === 0 && invs.length === 0) {
      return {
        success: false,
        message: 'No medicines, batches, or invoices found in Firebase Cloud. Try clicking "Upload Local Data to Firebase" first.',
      };
    }

    setSyncingFromCloud(true);
    try {
      // Save into local Dexie
      await db.transaction('rw', [
        db.workspaces,
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
        if (workspaces.length > 0) {
          await db.workspaces.clear();
          await db.workspaces.bulkAdd(workspaces);
        }
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
    } finally {
      setSyncingFromCloud(false);
    }

    // Auto-backfill payments from all downloaded invoices so customer payments stay 100% complete
    try {
      const newlyBackfilled = await backfillInvoicePaymentsToLocalDb();
      if (newlyBackfilled.length > 0) {
        let b = writeBatch(firestore);
        let bCount = 0;
        for (const p of newlyBackfilled) {
          b.set(doc(firestore, 'customerPayments', p.id), sanitizeForFirestore(p));
          bCount++;
          if (bCount >= 400) {
            await b.commit();
            b = writeBatch(firestore);
            bCount = 0;
          }
        }
        if (bCount > 0) {
          await b.commit();
        }
      }
    } catch (backfillErr) {
      console.warn('Error syncing backfilled payments after cloud download:', backfillErr);
    }

    return {
      success: true,
      message: `Downloaded ${workspaces.length} companies, ${meds.length} products, ${batches.length} batches, and ${invs.length} invoices from Firebase Cloud!`,
    };
  } catch (err: any) {
    console.error('Error downloading from cloud:', err);
    return { success: false, message: err?.message || 'Failed to download from Firebase Cloud' };
  }
}
