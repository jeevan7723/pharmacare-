import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
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
  console.log('[1/4] Connecting to Firestore...');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // Read all bills from generated_bills or invoices
  const snap = await getDocs(collection(db, 'invoices'));
  const allBills = [];
  const seenNos = new Map();

  snap.forEach((d) => {
    const data = d.data();
    // avoid duplicates if doc.id was already an invoiceNo
    if (d.id.startsWith('INV-')) return;
    allBills.push(data);
  });

  console.log(`[2/4] Found ${allBills.length} unique bills to store in collection 'invoices' and 'bills'...`);

  let batch = writeBatch(db);
  let count = 0;

  const commitIfNeeded = async () => {
    count++;
    if (count >= 350) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  };

  for (const bill of allBills) {
    const rawNo = bill.invoiceNo || 'INV-2026-0000';
    let docKey = rawNo;
    if (seenNos.has(rawNo)) {
      const idx = seenNos.get(rawNo) + 1;
      seenNos.set(rawNo, idx);
      docKey = `${rawNo}-${idx}`;
    } else {
      seenNos.set(rawNo, 1);
    }

    const wsId = bill.workspaceId || 'ws_healthplus';

    const invoicePayload = {
      ...bill,
      billNo: bill.invoiceNo,
      collection: 'invoices',
      recordType: 'Retail Sales Tax Invoice',
      storedAt: new Date().toISOString(),
    };

    // 1. Store with clean invoice number in 'invoices' collection
    batch.set(doc(db, 'invoices', docKey), sanitize(invoicePayload));
    await commitIfNeeded();

    // 2. Also ensure 'invoices/{bill.id}' has the complete payload
    batch.set(doc(db, 'invoices', bill.id), sanitize(invoicePayload));
    await commitIfNeeded();

    // 3. Store in 'bills' collection
    batch.set(doc(db, 'bills', docKey), sanitize(invoicePayload));
    await commitIfNeeded();
    batch.set(doc(db, 'bills', bill.id), sanitize(invoicePayload));
    await commitIfNeeded();

    // 4. Store in company subcollections
    batch.set(doc(db, 'companies', wsId, 'invoices', docKey), sanitize(invoicePayload));
    await commitIfNeeded();
    batch.set(doc(db, 'companies', wsId, 'bills', docKey), sanitize(invoicePayload));
    await commitIfNeeded();

    console.log(`Stored bill [${docKey}] in 'invoices' and 'bills' collection (Company: ${wsId})`);
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log('[3/4] Updating company documents with complete invoices list...');
  const wsSnap = await getDocs(collection(db, 'workspaces'));
  for (const w of wsSnap.docs) {
    const wsId = w.id;
    const wsBills = allBills.filter((b) => (b.workspaceId || 'ws_healthplus') === wsId);
    const compRef = doc(db, 'companies', wsId);
    await setDoc(
      compRef,
      sanitize({
        invoices: wsBills,
        bills: wsBills,
        generated_bills: wsBills,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
    console.log(`Updated company [${wsId}] with ${wsBills.length} invoices in document.`);
  }

  console.log('[4/4] Flushing network stream...');
  await waitForPendingWrites(db);
  console.log('All bills successfully stored in collection "invoices" and "bills"!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
