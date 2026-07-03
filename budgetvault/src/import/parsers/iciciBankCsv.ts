import { ParsedFileMeta, RawTransaction, StatementParser } from '../../types';
import { parseDate, parseIndianAmount, sanitizeNarration } from '../normalize';

// ICICI Bank CSV format:
// Has several header rows (account info, date range, etc.)
// Column row contains: Transaction Date, Value Date, Description, Ref No./Cheque No., Debit, Credit, Balance
export class IciciBankCsvParser implements StatementParser {
  bank = 'icici_csv';

  canParse(file: ParsedFileMeta, firstBytes?: string): number {
    if (file.extension.toLowerCase() !== 'csv') return 0;
    if (!firstBytes) return 0;
    const upper = firstBytes.toUpperCase();
    if (upper.includes('ICICI') || upper.includes('TRANSACTION DATE') && upper.includes('VALUE DATE')) {
      return 0.9;
    }
    return 0;
  }

  async parse(fileContent: string | ArrayBuffer, _meta: ParsedFileMeta): Promise<RawTransaction[]> {
    const text = typeof fileContent === 'string'
      ? fileContent
      : new TextDecoder().decode(fileContent);

    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const headerIdx = findHeaderLine(lines);
    if (headerIdx === -1) throw new Error('ICICI CSV: cannot find column header row');

    const header = splitCsvLine(lines[headerIdx]).map(h => h.trim().toUpperCase());
    const col = {
      date: findCol(header, ['TRANSACTION DATE', 'DATE', 'TXN DATE']),
      narration: findCol(header, ['DESCRIPTION', 'NARRATION', 'PARTICULARS']),
      debit: findCol(header, ['DEBIT', 'WITHDRAWAL']),
      credit: findCol(header, ['CREDIT', 'DEPOSIT']),
      balance: findCol(header, ['BALANCE', 'CLOSING BALANCE']),
      refNo: findCol(header, ['REF NO./CHEQUE NO.', 'REF NO', 'CHEQUE NUMBER', 'CHQ NO']),
    };

    if (col.date === -1 || col.narration === -1) {
      throw new Error('ICICI CSV: missing required columns (Date, Description)');
    }

    const rows: RawTransaction[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      if (cols.length < 3) continue;
      const dateStr = cols[col.date]?.trim() ?? '';
      if (!dateStr || dateStr.toLowerCase() === 'transaction date' || dateStr.toLowerCase() === 'date') continue;

      try {
        const txn_date = parseDate(dateStr);
        const narration = sanitizeNarration(cols[col.narration]?.trim() ?? '');
        if (!narration) continue;

        const debitVal = col.debit !== -1 ? parseIndianAmount(cols[col.debit] ?? '') : 0;
        const creditVal = col.credit !== -1 ? parseIndianAmount(cols[col.credit] ?? '') : 0;

        let amount: number;
        let direction: 'debit' | 'credit';
        if (debitVal > 0) {
          amount = debitVal;
          direction = 'debit';
        } else if (creditVal > 0) {
          amount = creditVal;
          direction = 'credit';
        } else {
          continue;
        }

        const row: RawTransaction = {
          txn_date,
          narration,
          amount,
          direction,
          ref_no: col.refNo !== -1 ? (cols[col.refNo]?.trim() || undefined) : undefined,
          balance_after: col.balance !== -1 ? parseIndianAmount(cols[col.balance] ?? '') || undefined : undefined,
        };
        rows.push(row);
      } catch {
        continue;
      }
    }
    return rows;
  }
}

function findHeaderLine(lines: string[]): number {
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const upper = lines[i].toUpperCase();
    if ((upper.includes('TRANSACTION DATE') || upper.includes('DATE')) &&
        (upper.includes('DESCRIPTION') || upper.includes('NARRATION') || upper.includes('PARTICULARS'))) {
      return i;
    }
  }
  return -1;
}

function findCol(header: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = header.findIndex(h => h === c || h.startsWith(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
