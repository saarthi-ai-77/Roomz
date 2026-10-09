import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format bigint paise into Indian Rupee string (₹).
 * e.g., 10050n -> "₹100.50"
 */
export function formatPaise(paise: bigint | number): string {
  const paiseBig = typeof paise === 'number' ? BigInt(Math.round(paise)) : paise;
  const isNegative = paiseBig < 0n;
  const absPaise = isNegative ? -paiseBig : paiseBig;
  const rupees = absPaise / 100n;
  const remainder = absPaise % 100n;
  const remainderStr = remainder.toString().padStart(2, '0');

  // Format rupees according to Indian numbering system (e.g. 1,00,000)
  const rupeesStr = rupees.toLocaleString('en-IN');
  const formatted = `₹${rupeesStr}.${remainderStr}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Parse an INR decimal string or number (e.g., "120.50" or 120.5) into bigint paise.
 */
export function parseINRToPaise(amount: string | number): bigint {
  if (typeof amount === 'number') {
    return BigInt(Math.round(amount * 100));
  }
  const cleaned = amount.trim().replace(/,/g, '');
  if (!cleaned || isNaN(Number(cleaned))) {
    return 0n;
  }
  const parts = cleaned.split('.');
  const whole = BigInt(parts[0] || '0');
  const decimal = parts[1] || '0';
  const paddedDecimal = (decimal + '00').slice(0, 2);
  const paise = BigInt(paddedDecimal);
  return whole * 100n + (whole < 0n ? -paise : paise);
}

/**
 * Returns current month string "YYYY-MM" in Asia/Kolkata timezone.
 */
export function getCurrentMonthKolkata(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  });
  // en-CA formats as YYYY-MM
  return formatter.format(now).slice(0, 7);
}

/**
 * Format a Date or date string to Indian format DD MMM YYYY.
 */
export function formatDate(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}
