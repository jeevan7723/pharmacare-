import JsBarcode from 'jsbarcode';
import { db } from '../db/db';
import { Medicine, Batch } from '../types';
import { syncMedicineToCloud, syncBatchToCloud } from '../firebase/firestoreService';

/**
 * Generate a standard 13-digit EAN-13 compliant barcode.
 * Uses 890 (India GS1 country prefix for pharmaceuticals) + 9 random digits + 1 checksum digit.
 */
export function generateEAN13(prefix = '890'): string {
  let code = prefix;
  while (code.length < 12) {
    code += Math.floor(Math.random() * 10).toString();
  }

  // Calculate EAN-13 check digit (Mod 10 with alternating weights 1 and 3)
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return code + checkDigit.toString();
}

/**
 * Generates an alphanumeric or EAN-13 barcode for a medicine.
 */
export function generateMedicineBarcode(existingBarcodes?: Set<string>): string {
  let barcode = generateEAN13('890');
  if (existingBarcodes) {
    let attempts = 0;
    while (existingBarcodes.has(barcode) && attempts < 100) {
      barcode = generateEAN13('890');
      attempts++;
    }
  }
  return barcode;
}

/**
 * Renders a crisp barcode on an SVG element using JsBarcode.
 */
export function renderBarcode(
  svgElement: SVGSVGElement | null,
  value: string,
  options?: {
    height?: number;
    width?: number;
    fontSize?: number;
    displayValue?: boolean;
    margin?: number;
  }
) {
  if (!svgElement || !value) return;

  try {
    JsBarcode(svgElement, value, {
      format: 'CODE128',
      width: options?.width || 1.6,
      height: options?.height || 45,
      displayValue: options?.displayValue !== false,
      fontSize: options?.fontSize || 12,
      font: 'JetBrains Mono, monospace',
      margin: options?.margin !== undefined ? options?.margin : 6,
      background: '#ffffff',
      lineColor: '#0f172a',
    });
  } catch (err) {
    console.warn('Barcode rendering error:', err);
  }
}

/**
 * Audio synthesizer for realistic POS barcode scanner feedback.
 */
export function playBarcodeBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, ctx.currentTime); // High-pitched clean POS beep
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch {
    // Ignore audio if blocked by browser policy
  }
}

/**
 * Ensures all medicines and batches in the local database have a valid barcode.
 * Automatically generates barcodes for any entries that lack one.
 */
export async function ensureAllBarcodes(): Promise<{ updatedMedicines: number; updatedBatches: number }> {
  const medicines = await db.medicines.toArray();
  const batches = await db.batches.toArray();

  const existing = new Set<string>();
  medicines.forEach((m) => m.barcode && existing.add(m.barcode));
  batches.forEach((b) => b.barcode && existing.add(b.barcode));

  let updatedMedicines = 0;
  let updatedBatches = 0;

  // 1. Assign to medicines that lack barcode
  for (const med of medicines) {
    if (!med.barcode) {
      // Check if medicine has a batch with barcode we can inherit
      const medBatch = batches.find((b) => b.medicineId === med.id && b.barcode);
      const barcode = medBatch?.barcode || generateMedicineBarcode(existing);
      existing.add(barcode);

      await db.medicines.update(med.id, { barcode });
      med.barcode = barcode;
      syncMedicineToCloud(med);
      updatedMedicines++;
    }
  }

  // 2. Assign to batches that lack barcode
  for (const batch of batches) {
    if (!batch.barcode) {
      const parentMed = medicines.find((m) => m.id === batch.medicineId);
      const barcode = parentMed?.barcode || generateMedicineBarcode(existing);
      existing.add(barcode);

      await db.batches.update(batch.id, { barcode });
      batch.barcode = barcode;
      syncBatchToCloud(batch);
      updatedBatches++;
    }
  }

  return { updatedMedicines, updatedBatches };
}
