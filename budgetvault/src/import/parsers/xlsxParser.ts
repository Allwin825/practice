import * as XLSX from 'xlsx';
import { ParsedFileMeta, RawTransaction, StatementParser } from '../../types';
import { parseDate, parseIndianAmount, parseDirection, sanitizeNarration } from '../normalize';

const DATE_KEYWORDS = ['date', 'txn date', 'transaction date', 'value date', 'posting date'];
const NARRATION_KEYWORDS = ['narration', 'description', 'particulars', 'details', 'remarks', 'payee'];
const DEBIT_KEYWORDS = ['debit', 'withdrawal', 'dr', 'withdrawals'];
const CREDIT_KEYWORDS = ['credit', 'deposit', 'cr', 'deposits'];
const AMOUNT_KEYWORDS = ['amount', 'txn amount'];
const BALANCE_KEYWORDS = ['balance', 'running balance', 'closing balance'];
const REF_KEYWORDS = ['ref', 'ref no', 'reference', 'chq no', 'cheque no', 'utr'];

interface ColMapping {
  date: number;
  narration: number;
  debit?: number;
  credit?: number;
  amount?: number;
  direction?: number;
  balance?: number;
  refNo?: number;
}

export class XlsxParser implements StatementParser {
  bank = 'generic_xlsx';

  canParse(file: ParsedFileMeta): number {
    const ext = file.extension.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') return 0.4;
    return 0;
  }

  async parse(fileContent: string | ArrayBuffer, _meta: ParsedFileMeta): Promise<RawTransaction[]> {
    const data =
      typeof fileContent === 'string'
        ? fileContent
        : fileContent;

    const wb = XLSX.read(data, { type: typeof fileContent === 'string' ? 'string' : 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: false,
      dateNF: 'YYYY-MM-DD',
    });

    if (rawRows.length < 2) return [];

    const headerRow = (rawRows[0] as string[]).map((h) =>
      String(h ?? '').trim().toLowerCase()
    );

    const mapping = autoDetectMapping(headerRow);
    if (!mapping) throw new Error('Cannot auto-detect XLSX column layout. Please export as CSV and use the CSV importer.');

    const rows: RawTransaction[] = [];

    for (let i = 1; i < rawRows.length; i++) {
      const cols = rawRows[i] as string[];
      if (!cols || cols.every((c) => !c)) continue;

      try {
        const rawDate = String(cols[mapping.date] ?? '').trim();
        if (!rawDate) continue;
        const txn_date = parseDate(rawDate);

        const narration = sanitizeNarration(String(cols[mapping.narration] ?? '').trim());
        if (!narration) continue;

        let amount: number;
        let direction: 'debit' | 'credit';

        if (mapping.debit !== undefined && mapping.credit !== undefined) {
          const debitVal = parseIndianAmount(String(cols[mapping.debit] ?? '0'));
          const creditVal = parseIndianAmount(String(cols[mapping.credit] ?? '0'));
          if (debitVal > 0) {
            amount = debitVal;
            direction = 'debit';
          } else {
            amount = creditVal;
            direction = 'credit';
          }
        } else if (mapping.amount !== undefined) {
          const raw = String(cols[mapping.amount] ?? '0');
          amount = parseIndianAmount(raw);
          direction = mapping.direction !== undefined
            ? parseDirection(String(cols[mapping.direction] ?? ''))
            : parseDirection('', parseFloat(raw.replace(/,/g, '')));
        } else {
          continue;
        }

        if (amount === 0) continue;

        const row: RawTransaction = { txn_date, narration, amount, direction };

        if (mapping.balance !== undefined) {
          const bal = parseIndianAmount(String(cols[mapping.balance] ?? ''));
          if (bal > 0) row.balance_after = bal;
        }
        if (mapping.refNo !== undefined) {
          const ref = String(cols[mapping.refNo] ?? '').trim();
          if (ref) row.ref_no = ref;
        }

        rows.push(row);
      } catch {
        // skip unparseable row
      }
    }

    return rows;
  }
}

function find(headers: string[], keywords: string[]): number {
  return headers.findIndex((h) => keywords.some((k) => h.includes(k)));
}

function autoDetectMapping(headers: string[]): ColMapping | null {
  const dateIdx = find(headers, DATE_KEYWORDS);
  const narIdx = find(headers, NARRATION_KEYWORDS);
  if (dateIdx === -1 || narIdx === -1) return null;

  const mapping: Partial<ColMapping> = { date: dateIdx, narration: narIdx };

  const debitIdx = find(headers, DEBIT_KEYWORDS);
  const creditIdx = find(headers, CREDIT_KEYWORDS);
  const amtIdx = find(headers, AMOUNT_KEYWORDS);

  if (debitIdx !== -1 && creditIdx !== -1) {
    mapping.debit = debitIdx;
    mapping.credit = creditIdx;
  } else if (amtIdx !== -1) {
    mapping.amount = amtIdx;
  } else {
    return null;
  }

  const balIdx = find(headers, BALANCE_KEYWORDS);
  if (balIdx !== -1) mapping.balance = balIdx;

  const refIdx = find(headers, REF_KEYWORDS);
  if (refIdx !== -1) mapping.refNo = refIdx;

  return mapping as ColMapping;
}
