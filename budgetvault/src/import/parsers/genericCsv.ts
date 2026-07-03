import { ParsedFileMeta, RawTransaction, StatementParser } from '../../types';
import { parseDate, parseIndianAmount, parseDirection, sanitizeNarration } from '../normalize';

export interface ColumnMapping {
  date: number;
  narration: number;
  debit?: number;
  credit?: number;
  amount?: number;
  direction?: number;
  balance?: number;
  refNo?: number;
}

export class GenericCsvParser implements StatementParser {
  bank = 'generic_csv';
  private mapping: ColumnMapping | null = null;

  canParse(file: ParsedFileMeta): number {
    const ext = file.extension.toLowerCase();
    if (ext === 'csv') return 0.3;
    return 0;
  }

  setMapping(mapping: ColumnMapping): void {
    this.mapping = mapping;
  }

  async parse(
    fileContent: string | ArrayBuffer,
    _meta: ParsedFileMeta
  ): Promise<RawTransaction[]> {
    const text =
      typeof fileContent === 'string'
        ? fileContent
        : new TextDecoder().decode(fileContent);

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const mapping = this.mapping ?? autoDetectMapping(lines[0]);
    if (!mapping) throw new Error('Cannot auto-detect CSV column layout. Please map columns manually.');

    const rows: RawTransaction[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      if (cols.length < 2) continue;

      try {
        const txn_date = parseDate(cols[mapping.date]?.trim() ?? '');
        const narration = sanitizeNarration(cols[mapping.narration]?.trim() ?? '');
        if (!narration) continue;

        let amount: number;
        let direction: 'debit' | 'credit';

        if (mapping.debit !== undefined && mapping.credit !== undefined) {
          const debitVal = parseIndianAmount(cols[mapping.debit] ?? '0');
          const creditVal = parseIndianAmount(cols[mapping.credit] ?? '0');
          if (debitVal > 0) {
            amount = debitVal;
            direction = 'debit';
          } else {
            amount = creditVal;
            direction = 'credit';
          }
        } else if (mapping.amount !== undefined) {
          const raw = cols[mapping.amount] ?? '0';
          amount = parseIndianAmount(raw);
          direction = mapping.direction !== undefined
            ? parseDirection(cols[mapping.direction] ?? '')
            : parseDirection('', parseFloat(raw.replace(/,/g, '')));
        } else {
          continue;
        }

        if (amount === 0) continue;

        const row: RawTransaction = {
          txn_date,
          narration,
          amount,
          direction,
        };

        if (mapping.balance !== undefined) {
          const bal = parseIndianAmount(cols[mapping.balance] ?? '');
          if (bal > 0) row.balance_after = bal;
        }
        if (mapping.refNo !== undefined) {
          const ref = cols[mapping.refNo]?.trim();
          if (ref) row.ref_no = ref;
        }

        rows.push(row);
      } catch {
        // skip unparseable rows
      }
    }
    return rows;
  }
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let inQuote = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const DATE_KEYWORDS = ['date', 'txn date', 'transaction date', 'value date', 'posting date'];
const NARRATION_KEYWORDS = ['narration', 'description', 'particulars', 'details', 'remarks', 'payee'];
const DEBIT_KEYWORDS = ['debit', 'withdrawal', 'dr', 'withdrawals'];
const CREDIT_KEYWORDS = ['credit', 'deposit', 'cr', 'deposits'];
const AMOUNT_KEYWORDS = ['amount', 'txn amount'];
const BALANCE_KEYWORDS = ['balance', 'running balance', 'closing balance'];
const REF_KEYWORDS = ['ref', 'ref no', 'reference', 'chq no', 'cheque no', 'utr'];

function autoDetectMapping(headerLine: string): ColumnMapping | null {
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const mapping: Partial<ColumnMapping> = {};

  const find = (keywords: string[]) =>
    headers.findIndex((h) => keywords.some((k) => h.includes(k)));

  const dateIdx = find(DATE_KEYWORDS);
  const narIdx = find(NARRATION_KEYWORDS);
  if (dateIdx === -1 || narIdx === -1) return null;

  mapping.date = dateIdx;
  mapping.narration = narIdx;

  const debitIdx = find(DEBIT_KEYWORDS);
  const creditIdx = find(CREDIT_KEYWORDS);
  const amtIdx = find(AMOUNT_KEYWORDS);

  if (debitIdx !== -1 && creditIdx !== -1) {
    mapping.debit = debitIdx;
    mapping.credit = creditIdx;
  } else if (amtIdx !== -1) {
    mapping.amount = amtIdx;
  } else {
    return null;
  }

  const balIdx = find(BALANCE_KEYWORDS);
  if (balIdx !== -1) mapping.balance = balIdx;

  const refIdx = find(REF_KEYWORDS);
  if (refIdx !== -1) mapping.refNo = refIdx;

  return mapping as ColumnMapping;
}
