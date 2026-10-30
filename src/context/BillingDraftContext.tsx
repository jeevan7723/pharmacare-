import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CartItem, Customer, HeldBill } from '../types';
import { db } from '../db/db';
import { formatCurrency } from '../utils/formatters';

export const DRAFT_STORAGE_KEY = 'pharmacare_pos_active_draft';

export interface POSDraft {
  customerPhone: string;
  customerName: string;
  selectedCustomer: Customer | null;
  doctorName: string;
  doctorRegNo: string;
  cart: CartItem[];
  overallDiscountPercent: number;
  billNotes: string;
}

export const loadPOSDraft = (): POSDraft | null => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error loading POS draft from localStorage:', err);
  }
  return null;
};

export const savePOSDraftSync = (draft: Partial<POSDraft>) => {
  try {
    const existing = loadPOSDraft() || {
      customerPhone: '',
      customerName: '',
      selectedCustomer: null,
      doctorName: '',
      doctorRegNo: '',
      cart: [],
      overallDiscountPercent: 0,
      billNotes: '',
    };
    const merged: POSDraft = { ...existing, ...draft };
    const hasAny =
      merged.cart.length > 0 ||
      (merged.customerPhone && merged.customerPhone.trim() !== '') ||
      (merged.customerName && merged.customerName.trim() !== '') ||
      (merged.doctorName && merged.doctorName.trim() !== '') ||
      (merged.billNotes && merged.billNotes.trim() !== '') ||
      merged.overallDiscountPercent > 0;

    if (hasAny) {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(merged));
    } else {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Error saving POS draft to localStorage:', err);
  }
};

export interface BillingDraftContextType {
  customerPhone: string;
  setCustomerPhone: (val: string) => void;
  customerName: string;
  setCustomerName: (val: string) => void;
  selectedCustomer: Customer | null;
  setSelectedCustomer: (val: Customer | null) => void;
  doctorName: string;
  setDoctorName: (val: string) => void;
  doctorRegNo: string;
  setDoctorRegNo: (val: string) => void;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  overallDiscountPercent: number;
  setOverallDiscountPercent: (val: number) => void;
  billNotes: string;
  setBillNotes: (val: string) => void;
  clearDraft: () => void;
  holdDraft: (symbol?: string) => Promise<boolean>;
  syncDraftFromStorage: () => void;
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalGst: number;
  cgstAmount: number;
  sgstAmount: number;
  grandTotal: number;
  roundOff: number;
  totalQty: number;
  hasActiveDraft: boolean;
}

const BillingDraftContext = createContext<BillingDraftContextType | undefined>(undefined);

export const BillingDraftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load draft synchronously on initial state creation
  const initial = loadPOSDraft();

  const [customerPhone, setCustomerPhoneState] = useState<string>(initial?.customerPhone || '');
  const [customerName, setCustomerNameState] = useState<string>(initial?.customerName || '');
  const [selectedCustomer, setSelectedCustomerState] = useState<Customer | null>(initial?.selectedCustomer || null);
  const [doctorName, setDoctorNameState] = useState<string>(initial?.doctorName || '');
  const [doctorRegNo, setDoctorRegNoState] = useState<string>(initial?.doctorRegNo || '');
  const [cart, setCartState] = useState<CartItem[]>(initial?.cart || []);
  const [overallDiscountPercent, setOverallDiscountPercentState] = useState<number>(initial?.overallDiscountPercent || 0);
  const [billNotes, setBillNotesState] = useState<string>(initial?.billNotes || '');

  // Synchronous setters that update React state AND immediately persist to localStorage
  const setCustomerPhone = useCallback((val: string) => {
    setCustomerPhoneState(val);
    savePOSDraftSync({ customerPhone: val });
  }, []);

  const setCustomerName = useCallback((val: string) => {
    setCustomerNameState(val);
    savePOSDraftSync({ customerName: val });
  }, []);

  const setSelectedCustomer = useCallback((val: Customer | null) => {
    setSelectedCustomerState(val);
    savePOSDraftSync({ selectedCustomer: val });
  }, []);

  const setDoctorName = useCallback((val: string) => {
    setDoctorNameState(val);
    savePOSDraftSync({ doctorName: val });
  }, []);

  const setDoctorRegNo = useCallback((val: string) => {
    setDoctorRegNoState(val);
    savePOSDraftSync({ doctorRegNo: val });
  }, []);

  const setCart = useCallback((updater: React.SetStateAction<CartItem[]>) => {
    setCartState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      savePOSDraftSync({ cart: next });
      return next;
    });
  }, []);

  const setOverallDiscountPercent = useCallback((val: number) => {
    setOverallDiscountPercentState(val);
    savePOSDraftSync({ overallDiscountPercent: val });
  }, []);

  const setBillNotes = useCallback((val: string) => {
    setBillNotesState(val);
    savePOSDraftSync({ billNotes: val });
  }, []);

  // Sync state from localStorage whenever needed (e.g. when switching back to billing)
  const syncDraftFromStorage = useCallback(() => {
    const d = loadPOSDraft();
    if (d) {
      setCustomerPhoneState(d.customerPhone || '');
      setCustomerNameState(d.customerName || '');
      setSelectedCustomerState(d.selectedCustomer || null);
      setDoctorNameState(d.doctorName || '');
      setDoctorRegNoState(d.doctorRegNo || '');
      setCartState(d.cart || []);
      setOverallDiscountPercentState(d.overallDiscountPercent || 0);
      setBillNotesState(d.billNotes || '');
    }
  }, []);

  // Cart Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.qty * item.unitRate, 0);
  const totalItemAmount = cart.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalDiscount = subtotal - totalItemAmount;
  const taxableAmount = cart.reduce((sum, item) => sum + item.taxableAmount, 0);
  const totalGst = cart.reduce((sum, item) => sum + item.gstAmount, 0);
  const cgstAmount = totalGst / 2;
  const sgstAmount = totalGst / 2;
  const rawGrandTotal = totalItemAmount;
  const grandTotal = Math.round(rawGrandTotal);
  const roundOff = Number((grandTotal - rawGrandTotal).toFixed(2));
  const totalQty = cart.reduce((sum, item) => sum + item.qty + (item.freeQty || 0), 0);

  const hasActiveDraft =
    cart.length > 0 ||
    customerPhone.trim() !== '' ||
    customerName.trim() !== '' ||
    doctorName.trim() !== '' ||
    billNotes.trim() !== '' ||
    overallDiscountPercent > 0;

  const clearDraft = useCallback(() => {
    setCartState([]);
    setCustomerPhoneState('');
    setCustomerNameState('');
    setSelectedCustomerState(null);
    setDoctorNameState('');
    setDoctorRegNoState('');
    setOverallDiscountPercentState(0);
    setBillNotesState('');
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (err) {}
  }, []);

  const holdDraft = useCallback(
    async (symbol = '₹'): Promise<boolean> => {
      if (cart.length === 0) return false;
      try {
        const newHeld: HeldBill = {
          id: `hold-${Date.now()}`,
          holdTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          customerName: customerName.trim() || 'Walk-in Customer',
          customerPhone: customerPhone.trim(),
          doctorName: doctorName.trim(),
          items: [...cart],
          note: `${cart.length} items (${formatCurrency(grandTotal, symbol)})`,
        };
        await db.heldBills.put(newHeld);
        clearDraft();
        return true;
      } catch (err) {
        console.error('Failed to hold draft:', err);
        return false;
      }
    },
    [cart, customerName, customerPhone, doctorName, grandTotal, clearDraft]
  );

  return (
    <BillingDraftContext.Provider
      value={{
        customerPhone,
        setCustomerPhone,
        customerName,
        setCustomerName,
        selectedCustomer,
        setSelectedCustomer,
        doctorName,
        setDoctorName,
        doctorRegNo,
        setDoctorRegNo,
        cart,
        setCart,
        overallDiscountPercent,
        setOverallDiscountPercent,
        billNotes,
        setBillNotes,
        clearDraft,
        holdDraft,
        syncDraftFromStorage,
        subtotal,
        totalDiscount,
        taxableAmount,
        totalGst,
        cgstAmount,
        sgstAmount,
        grandTotal,
        roundOff,
        totalQty,
        hasActiveDraft,
      }}
    >
      {children}
    </BillingDraftContext.Provider>
  );
};

export const useBillingDraft = () => {
  const context = useContext(BillingDraftContext);
  if (!context) {
    throw new Error('useBillingDraft must be used within a BillingDraftProvider');
  }
  return context;
};
