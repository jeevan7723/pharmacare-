# PharmaCare Pro - Medical Store Billing & Pharmacy POS System

A high-speed, pharmacy-focused Point of Sale (POS) and inventory management billing system built specifically for retail chemists, druggists, and medical shops.

---

## ⚡ Quick Start

### Option 1: Double-click Launcher
Simply double-click **`start.bat`** in this folder. It will start the server and open the billing terminal in your default browser.

### Option 2: Command Line
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## ⌨️ Pharmacist Speed Keybindings (Zero Mouse Workflow)

Medical store checkout counters require rapid billing without touching the mouse:

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| **`F2`** | **New Bill** | Clears the counter and prepares a fresh bill |
| **`F4`** | **Quick Search** | Instantly focuses the medicine & salt search bar |
| **`F8`** | **Hold Bill** | Puts current customer's bill on hold to attend emergency walk-ins |
| **`F9`** | **Settle & Pay** | Opens checkout payment drawer (Cash change / UPI QR / Khata) |
| **`Esc`** | **Close Dialog** | Closes any open modal window |

---

## 🏥 Key Pharmacy Features

### 1. Point of Sale (POS) Billing Terminal
- **Fast Medicine & Salt Composition Search**: Search by Brand name (e.g. *Dolo 650*, *Augmentin 625*, *Pan D*), Generic Salt formula (e.g. *Paracetamol*, *Amoxicillin*), Barcode scan, or Rack location.
- **Physical Rack & Shelf Locator**: Displays exact physical location (e.g. `Rack A - Shelf 2`) on screen and bill line item so pharmacy helpers can grab boxes instantly.
- **Drug Schedule Compliance Alerts**: Visual warning flags for **Schedule H**, **Schedule H1**, and **Schedule X** prescription-only formulations.
- **Automatic Batch FEFO (First Expiring First Out)**: Automatically defaults to the earliest non-expired batch with available stock.
- **Expiry Warning at Billing**: Warns if a selected medicine is expired or expiring within 30 days.
- **Free Quantity Schemes**: Support for promotional schemes (e.g. `10 + 1 free`).
- **Hold & Recall Queue**: Suspend complex multi-item bills into a queue and resume them at any time.

### 2. Dual Invoice Print Formats
- **3-inch Thermal Slip (80mm POS Printer)**: Ultra-compact, clean thermal receipt formatted for POS receipt printers.
- **A4 / A5 Tax Invoice**: Full GST tax invoice with Drug License numbers (Form 20B & 21B), GSTIN, FSSAI, Doctor registration number, HSN codes, and CGST/SGST tax slabs.
- **Dynamic Contactless UPI QR Code**: Automatically embeds dynamic UPI payment QR code generated with exact bill amount and pharmacy VPA for instant Google Pay / PhonePe / Paytm scanning.

### 3. Inventory & Batch Management
- Comprehensive medicine catalog with generic names, manufacturers, pack sizes, categories, and HSN codes.
- Multi-batch tracking: track multiple batches per medicine with distinct expiry dates, cost prices, and MRPs.
- Real-time stock counts and low stock alert thresholds.

### 4. Stock Inward (Purchase from Wholesalers)
- Record supplier invoices from pharmaceutical distributors.
- Automatically increments batch stock counts and updates purchase prices.
- Purchase history register.

### 5. Drug Expiry & Return Watchtower
- **Expired Stock Alert**: Batch list of expired medicines with purchase loss value calculation and 1-click write-off / return.
- **Expiring in < 30 Days (Critical)**: Immediate distributor return claims.
- **Expiring in 31 - 90 Days (Warning)**: Clear out front-shelf stock.
- **Low Stock Re-order**: Shortage calculation with suggested order quantities.

### 6. Customer Khata (Credit Ledger)
- Neighborhood customer accounts with outstanding debt balances.
- Receive cash/UPI payments against Khata balance.
- Full ledger statements of all purchases and payment receipts.

### 7. Doctors & Prescribers Directory
- Maintain doctor names, clinics, specializations, and Medical Council Registration numbers (MCI Reg No) for printing on invoices.

### 8. GST Analytics & Reports
- Daily, weekly, monthly, and all-time revenue breakdown.
- **GSTR-1 Ready Tax Slab Table**: 0%, 5%, 12%, and 18% taxable turnovers with CGST and SGST collections.
- Fast-moving medicines ranking.
- **1-Click Export to CSV** for Chartered Accountants and Excel accounting.

### 9. Store Customization & Database Safety
- Configure pharmacy name, Drug License Form 20B & 21B, GSTIN, and custom terms.
- **Full Database Export (.json)**: Download full backup of all medicines, customers, and sales in 1 click.
- **Full Database Restore (.json)**: Upload and restore previous backups with zero data loss.
- **Reset to Demo Data**: Instant restoration of pre-loaded sample medical store database.

### 10. 🔥 Firebase Cloud Firestore Integration (`pharmacare-1d3a2`)
- **Direct Cloud Sync**: The software connects to your Firebase project `pharmacare-1d3a2`.
- **Real-Time Multi-Counter Billing**: Every invoice generated, batch updated, and customer payment recorded syncs to Cloud Firestore so multiple counters or tablets share the exact same inventory in real time.
- **Offline Fault Tolerance**: Built with Firestore persistent multi-tab local cache—billing continues uninterrupted even if your pharmacy's internet connection temporarily drops.
- **1-Click Cloud Seeding & Restore**: In **Settings > Firebase Cloud Firestore**, use **"Upload Local Data to Firebase"** to push all initial demo medicines and batches into the cloud, or **"Fetch / Sync from Firebase Cloud"** to pull data onto a new machine.
- **Security & Deployment**: Includes production-grade `firestore.rules`, `firebase.json`, `.firebaserc`, and `firestore.indexes.json`. To deploy rules to your Firebase console:
  ```bash
  npx firebase deploy --only firestore:rules
  ```


"# pharmacare-" 
