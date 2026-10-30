export function formatCurrency(amount: number, symbol: string = '₹'): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return `${symbol}${safeAmount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(isoOrDateStr: string): string {
  if (!isoOrDateStr) return '';
  try {
    const d = new Date(isoOrDateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoOrDateStr;
  }
}

export interface ExpiryStatus {
  status: 'expired' | 'critical' | 'warning' | 'good';
  label: string;
  badgeClass: string;
  textClass: string;
  daysRemaining: number;
}

export function checkExpiryStatus(expiryYearMonth: string): ExpiryStatus {
  if (!expiryYearMonth) {
    return {
      status: 'good',
      label: 'Valid',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      textClass: 'text-emerald-700',
      daysRemaining: 999,
    };
  }

  // Parse YYYY-MM
  const parts = expiryYearMonth.split('-');
  const expYear = parseInt(parts[0], 10);
  const expMonth = parseInt(parts[1], 10);

  // Last day of that expiry month
  const expiryDate = new Date(expYear, expMonth, 0, 23, 59, 59);
  const now = new Date();

  const diffMs = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return {
      status: 'expired',
      label: 'EXPIRED',
      badgeClass: 'bg-red-100 text-red-800 border-red-300 font-bold',
      textClass: 'text-red-600 font-semibold',
      daysRemaining: diffDays,
    };
  } else if (diffDays <= 30) {
    return {
      status: 'critical',
      label: `${diffDays}d left`,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-semibold animate-pulse',
      textClass: 'text-rose-600 font-semibold',
      daysRemaining: diffDays,
    };
  } else if (diffDays <= 90) {
    return {
      status: 'warning',
      label: `${Math.ceil(diffDays / 30)}m left`,
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      textClass: 'text-amber-600',
      daysRemaining: diffDays,
    };
  } else {
    return {
      status: 'good',
      label: `${expiryYearMonth}`,
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      textClass: 'text-emerald-700',
      daysRemaining: diffDays,
    };
  }
}

/**
 * Calculates line item amounts where unitRate is inclusive of GST (standard retail medicine pricing)
 */
export function calculateLineItemPricing(
  qty: number,
  unitRate: number,
  discountPercent: number = 0,
  gstPercent: number = 12
) {
  const safeQty = Math.max(0, qty);
  const gross = safeQty * unitRate;
  const discountAmount = gross * (discountPercent / 100);
  const totalAmount = gross - discountAmount;

  // Retail inclusive GST breakdown
  const gstFactor = 1 + gstPercent / 100;
  const taxableAmount = totalAmount / gstFactor;
  const gstAmount = totalAmount - taxableAmount;

  return {
    gross,
    discountAmount,
    taxableAmount: Number(taxableAmount.toFixed(2)),
    gstAmount: Number(gstAmount.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
  };
}

export function generateUpiQrUri(
  upiId: string,
  payeeName: string,
  amount: number,
  invoiceNo: string
): string {
  if (!upiId) return '';
  const cleanUpi = upiId.trim();
  const cleanName = encodeURIComponent(payeeName || 'Medical Store');
  const cleanNote = encodeURIComponent(`Bill ${invoiceNo}`);
  return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${amount.toFixed(2)}&tn=${cleanNote}&cu=INR`;
}

