import { db } from '../db/db';
import {
  syncInvoiceToCloud,
  deleteInvoiceFromCloud,
  syncCustomerPaymentToCloud,
  deleteCustomerPaymentFromCloud,
  syncCustomerToCloud,
  deleteCustomerFromCloud,
  syncMedicineToCloud,
  deleteMedicineFromCloud,
  syncBatchToCloud,
  deleteBatchFromCloud,
  syncDoctorToCloud,
  deleteDoctorFromCloud,
  syncSupplierToCloud,
  deleteSupplierFromCloud,
  syncPurchaseToCloud,
  deletePurchaseFromCloud,
  syncHeldBillToCloud,
  deleteHeldBillFromCloud,
  syncSettingsToCloud,
  isSyncingFromCloud,
  setSyncingFromCloud,
} from './firestoreService';

let isLiveSyncInitialized = false;

export { setSyncingFromCloud };

/**
 * Initializes automatic real-time Dexie change hooks.
 * Whenever ANY insert, update, or delete occurs locally in Dexie,
 * it immediately and automatically syncs live to Cloud Firestore!
 */
export function initLiveSyncEngine() {
  if (isLiveSyncInitialized) return;
  isLiveSyncInitialized = true;

  // 1. Invoices (Bills)
  db.invoices.hook('creating', function (this: any, _primKey, obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => syncInvoiceToCloud(obj);
  });
  db.invoices.hook('updating', function (this: any, _modifications, primKey, _obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = (updatedObj: any) => {
      if (updatedObj) syncInvoiceToCloud(updatedObj);
      else db.invoices.get(primKey).then((full) => full && syncInvoiceToCloud(full));
    };
  });
  db.invoices.hook('deleting', function (this: any, primKey) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => deleteInvoiceFromCloud(primKey as string);
  });

  // 2. Customer Payments (Khata Settlements)
  db.customerPayments.hook('creating', function (this: any, _primKey, obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => syncCustomerPaymentToCloud(obj);
  });
  db.customerPayments.hook('updating', function (this: any, _modifications, primKey, _obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = (updatedObj: any) => {
      if (updatedObj) syncCustomerPaymentToCloud(updatedObj);
      else db.customerPayments.get(primKey).then((full) => full && syncCustomerPaymentToCloud(full));
    };
  });
  db.customerPayments.hook('deleting', function (this: any, primKey) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => deleteCustomerPaymentFromCloud(primKey as string);
  });

  // 3. Customers (Accounts & Balances)
  db.customers.hook('creating', function (this: any, _primKey, obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => syncCustomerToCloud(obj);
  });
  db.customers.hook('updating', function (this: any, _modifications, primKey, _obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = (updatedObj: any) => {
      if (updatedObj) syncCustomerToCloud(updatedObj);
      else db.customers.get(primKey).then((full) => full && syncCustomerToCloud(full));
    };
  });
  db.customers.hook('deleting', function (this: any, primKey) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => deleteCustomerFromCloud(primKey as string);
  });

  // 4. Batches / Stock
  db.batches.hook('creating', function (this: any, _primKey, obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => syncBatchToCloud(obj);
  });
  db.batches.hook('updating', function (this: any, _modifications, primKey, _obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = (updatedObj: any) => {
      if (updatedObj) syncBatchToCloud(updatedObj);
      else db.batches.get(primKey).then((full) => full && syncBatchToCloud(full));
    };
  });
  db.batches.hook('deleting', function (this: any, primKey) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => deleteBatchFromCloud(primKey as string);
  });

  // 5. Medicines (Inventory Directory)
  db.medicines.hook('creating', function (this: any, _primKey, obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => syncMedicineToCloud(obj);
  });
  db.medicines.hook('updating', function (this: any, _modifications, primKey, _obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = (updatedObj: any) => {
      if (updatedObj) syncMedicineToCloud(updatedObj);
      else db.medicines.get(primKey).then((full) => full && syncMedicineToCloud(full));
    };
  });
  db.medicines.hook('deleting', function (this: any, primKey) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => deleteMedicineFromCloud(primKey as string);
  });

  // 6. Doctors
  db.doctors.hook('creating', function (this: any, _primKey, obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => syncDoctorToCloud(obj);
  });
  db.doctors.hook('updating', function (this: any, _modifications, primKey, _obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = (updatedObj: any) => {
      if (updatedObj) syncDoctorToCloud(updatedObj);
      else db.doctors.get(primKey).then((full) => full && syncDoctorToCloud(full));
    };
  });
  db.doctors.hook('deleting', function (this: any, primKey) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => deleteDoctorFromCloud(primKey as string);
  });

  // 7. Suppliers
  db.suppliers.hook('creating', function (this: any, _primKey, obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => syncSupplierToCloud(obj);
  });
  db.suppliers.hook('updating', function (this: any, _modifications, primKey, _obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = (updatedObj: any) => {
      if (updatedObj) syncSupplierToCloud(updatedObj);
      else db.suppliers.get(primKey).then((full) => full && syncSupplierToCloud(full));
    };
  });
  db.suppliers.hook('deleting', function (this: any, primKey) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => deleteSupplierFromCloud(primKey as string);
  });

  // 8. Purchases
  db.purchases.hook('creating', function (this: any, _primKey, obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => syncPurchaseToCloud(obj);
  });
  db.purchases.hook('updating', function (this: any, _modifications, primKey, _obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = (updatedObj: any) => {
      if (updatedObj) syncPurchaseToCloud(updatedObj);
      else db.purchases.get(primKey).then((full) => full && syncPurchaseToCloud(full));
    };
  });
  db.purchases.hook('deleting', function (this: any, primKey) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => deletePurchaseFromCloud(primKey as string);
  });

  // 9. Held Bills
  db.heldBills.hook('creating', function (this: any, _primKey, obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => syncHeldBillToCloud(obj);
  });
  db.heldBills.hook('updating', function (this: any, _modifications, primKey, _obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = (updatedObj: any) => {
      if (updatedObj) syncHeldBillToCloud(updatedObj);
      else db.heldBills.get(primKey).then((full) => full && syncHeldBillToCloud(full));
    };
  });
  db.heldBills.hook('deleting', function (this: any, primKey) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => deleteHeldBillFromCloud(primKey as string);
  });

  // 10. Store Settings
  db.settings.hook('creating', function (this: any, _primKey, obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = () => syncSettingsToCloud(obj);
  });
  db.settings.hook('updating', function (this: any, _modifications, primKey, _obj) {
    if (isSyncingFromCloud) return;
    this.onsuccess = (updatedObj: any) => {
      if (updatedObj) syncSettingsToCloud(updatedObj);
      else db.settings.get(primKey).then((full) => full && syncSettingsToCloud(full));
    };
  });

  console.log('⚡ [Live Sync Engine] Active: Every local database operation automatically syncs to Firebase Cloud.');
}
