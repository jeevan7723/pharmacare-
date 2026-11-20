import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  writeBatch,
  waitForPendingWrites,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBb8aNpfTSXCyJ8ONvRabqfgXWInHXhTSY',
  authDomain: 'pharmacare-1d3a2.firebaseapp.com',
  projectId: 'pharmacare-1d3a2',
  storageBucket: 'pharmacare-1d3a2.firebasestorage.app',
  messagingSenderId: '668753337521',
  appId: '1:668753337521:web:f06d98a5e4cc556b33d690',
};

function sanitize(data) {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) return data.map(sanitize);
  if (typeof data === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) res[k] = sanitize(v);
    }
    return res;
  }
  return data;
}

async function run() {
  console.log('[1/5] Initializing Firebase Firestore connection...');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // Fetch all existing collections
  console.log('[2/5] Fetching existing invoices and workspaces from Firestore...');
  const invsSnap = await getDocs(collection(db, 'invoices'));
  const allInvoices = [];
  invsSnap.forEach((d) => allInvoices.push(d.data()));
  console.log(`Found ${allInvoices.length} invoices in root 'invoices' collection.`);

  const wsSnap = await getDocs(collection(db, 'workspaces'));
  const allWorkspaces = [];
  wsSnap.forEach((d) => allWorkspaces.push(d.data()));
  console.log(`Found ${allWorkspaces.length} workspaces.`);

  const medsSnap = await getDocs(collection(db, 'medicines'));
  const allMeds = [];
  medsSnap.forEach((d) => allMeds.push(d.data()));

  const batchesSnap = await getDocs(collection(db, 'batches'));
  const allBatches = [];
  batchesSnap.forEach((d) => allBatches.push(d.data()));

  const supsSnap = await getDocs(collection(db, 'suppliers'));
  const allSups = [];
  supsSnap.forEach((d) => allSups.push(d.data()));

  const custsSnap = await getDocs(collection(db, 'customers'));
  const allCusts = [];
  custsSnap.forEach((d) => allCusts.push(d.data()));

  const purchasesSnap = await getDocs(collection(db, 'purchases'));
  const allPurchases = [];
  purchasesSnap.forEach((d) => allPurchases.push(d.data()));

  const paymentsSnap = await getDocs(collection(db, 'customerPayments'));
  const allPayments = [];
  paymentsSnap.forEach((d) => allPayments.push(d.data()));

  // 1. Write each invoice to root 'generated_bills' collection
  console.log('[3/5] Populating root collection "generated_bills"...');
  let b = writeBatch(db);
  let count = 0;
  for (const inv of allInvoices) {
    b.set(doc(db, 'generated_bills', inv.id), sanitize(inv));
    count++;
    if (count >= 400) {
      await b.commit();
      b = writeBatch(db);
      count = 0;
    }
  }
  if (count > 0) {
    await b.commit();
  }
  console.log(`Backed up ${allInvoices.length} bills into 'generated_bills' root collection.`);

  // 2. Populate each company in 'companies' collection with complete document and generated_bills subcollection
  console.log('[4/5] Populating all 4 companies in "companies" collection...');
  for (const ws of allWorkspaces) {
    const wsId = ws.id;
    const wsMeds = allMeds.filter((m) => (m.workspaceId || 'ws_healthplus') === wsId);
    const wsBatches = allBatches.filter((b) => (b.workspaceId || 'ws_healthplus') === wsId);
    const wsSups = allSups.filter((s) => (s.workspaceId || 'ws_healthplus') === wsId);
    const wsCusts = allCusts.filter((c) => (c.workspaceId || 'ws_healthplus') === wsId);
    const wsInvs = allInvoices.filter((i) => (i.workspaceId || 'ws_healthplus') === wsId);
    const wsPurchases = allPurchases.filter((p) => (p.workspaceId || 'ws_healthplus') === wsId);
    const wsPayments = allPayments.filter((p) => (p.workspaceId || 'ws_healthplus') === wsId);

    const totalRev = wsInvs.reduce((s, i) => s + (i.grandTotal || 0), 0);
    const totalUnits = wsBatches.reduce((s, b) => s + (b.stockQty || 0), 0);
    const totalDebt = wsCusts.reduce((s, c) => s + (c.outstandingBalance || 0), 0);

    const companyDoc = {
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
        totalProducts: wsMeds.length,
        totalBatches: wsBatches.length,
        totalStockUnits: totalUnits,
        totalSuppliers: wsSups.length,
        totalCustomers: wsCusts.length,
        totalInvoices: wsInvs.length,
        totalGeneratedBills: wsInvs.length,
        totalRevenue: Math.round(totalRev * 100) / 100,
        totalKhataDebt: Math.round(totalDebt * 100) / 100,
      },

      products: wsMeds,
      batches: wsBatches,
      suppliers: wsSups,
      customers: wsCusts,
      invoices: wsInvs,
      generated_bills: wsInvs,
      purchases: wsPurchases,
      customerPayments: wsPayments,
    };

    // Save company doc
    await setDoc(doc(db, 'companies', ws.id), sanitize(companyDoc));
    console.log(`Saved company: ${ws.id} (${ws.name}) with ${wsInvs.length} generated bills.`);

    // Save subcollections for each bill
    for (const inv of wsInvs) {
      await setDoc(doc(db, 'companies', ws.id, 'generated_bills', inv.id), sanitize(inv));
    }
  }

  // 3. Update Admin section
  console.log('[5/5] Updating "admin" collection (master_control and companies_registry)...');
  const adminDoc = {
    role: 'Super Admin Master Authority',
    platformName: 'PharmaCare Pro SaaS Multi-Tenant Billing Platform',
    masterPassword: 'jeevan@1234',
    masterUsername: 'jeevan',
    owner: 'Jeevan',
    lastSyncTimestamp: new Date().toISOString(),

    platformSummary: {
      totalClientCompanies: allWorkspaces.length,
      activeCompanies: allWorkspaces.filter((w) => w.license?.status === 'active').length,
      trialCompanies: allWorkspaces.filter((w) => w.license?.status === 'trial').length,
      suspendedCompanies: allWorkspaces.filter((w) => w.license?.status === 'suspended').length,
      totalCatalogProducts: allMeds.length,
      totalStockUnits: allBatches.reduce((s, b) => s + (b.stockQty || 0), 0),
      totalGlobalSuppliers: allSups.length,
      totalGlobalBills: allInvoices.length,
      totalPlatformRevenue: Math.round(allInvoices.reduce((s, i) => s + (i.grandTotal || 0), 0) * 100) / 100,
    },

    companiesRegistry: allWorkspaces.map((w) => {
      const wInvs = allInvoices.filter((i) => (i.workspaceId || 'ws_healthplus') === w.id);
      return {
        id: w.id,
        name: w.name,
        slug: w.slug,
        industry: w.industry,
        theme: w.theme,
        totalGeneratedBills: wInvs.length,
        totalRevenue: Math.round(wInvs.reduce((s, i) => s + (i.grandTotal || 0), 0) * 100) / 100,
        licenseKey: w.license?.licenseKey,
        plan: w.license?.plan,
        status: w.license?.status,
        validUntil: w.license?.validUntil,
        ownerName: w.license?.ownerName,
        ownerPhone: w.license?.ownerPhone,
        ownerEmail: w.license?.ownerEmail,
        gstin: w.settings?.gstin,
      };
    }),

    securityControls: {
      passwordRequired: true,
      masterAuthMethod: 'PIN/Password Authentication',
      sessionTimeoutMinutes: 60,
      remoteKillSwitchEnabled: true,
    },
  };

  await setDoc(doc(db, 'admin', 'master_control'), sanitize(adminDoc));
  await setDoc(
    doc(db, 'admin', 'companies_registry'),
    sanitize({
      totalCompanies: allWorkspaces.length,
      companies: adminDoc.companiesRegistry,
      updatedAt: new Date().toISOString(),
    })
  );

  console.log('Flushing pending writes to Firestore network...');
  await waitForPendingWrites(db);
  console.log('Firestore synchronization 100% complete!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error during sync:', err);
  process.exit(1);
});
