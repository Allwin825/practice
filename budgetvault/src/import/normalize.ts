import { Direction } from '../types';

// Indian rupee grouping: 1,23,456.78
export function parseIndianAmount(raw: string): number {
  const cleaned = raw.replace(/[,\s₹Rs]/gi, '').trim();
  if (!cleaned) return 0;
  const num = parseFloat(cleaned);
  if (isNaN(num)) throw new Error(`Cannot parse amount: "${raw}"`);
  return Math.abs(num);
}

// Handles: DD/MM/YYYY, DD-MM-YYYY, DD-MMM-YY, YYYY-MM-DD, DD MMM YYYY
export function parseDate(raw: string): string {
  const MONTHS: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04',
    MAY: '05', JUN: '06', JUL: '07', AUG: '08',
    SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  };

  const s = raw.trim();

  // YYYY-MM-DD already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  // DD-MMM-YY or DD MMM YYYY
  const dmmy = s.match(/^(\d{1,2})[\-\s]([A-Za-z]{3})[\-\s](\d{2,4})$/);
  if (dmmy) {
    const mon = MONTHS[dmmy[2].toUpperCase()];
    const yr = dmmy[3].length === 2 ? `20${dmmy[3]}` : dmmy[3];
    const day = dmmy[1].padStart(2, '0');
    if (mon) return `${yr}-${mon}-${day}`;
  }

  // DD/MM/YY
  const dmyShort = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{2})$/);
  if (dmyShort) return `20${dmyShort[3]}-${dmyShort[2]}-${dmyShort[1]}`;

  throw new Error(`Cannot parse date: "${raw}"`);
}

export function parseDirection(raw: string, amount?: number): Direction {
  const upper = raw.trim().toUpperCase();
  if (upper === 'DR' || upper === 'DEBIT' || upper === 'D') return 'debit';
  if (upper === 'CR' || upper === 'CREDIT' || upper === 'C') return 'credit';
  if (amount !== undefined && amount < 0) return 'debit';
  if (amount !== undefined && amount > 0) return 'credit';
  return 'debit';
}

export function sanitizeNarration(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}
