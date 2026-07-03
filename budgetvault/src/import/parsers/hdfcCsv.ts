import { ParsedFileMeta, RawTransaction, StatementParser } from '../../types';
import { parseDate, parseIndianAmount, sanitizeNarration } from '../normalize';

// HDFC Bank CSV format:
// Header rows vary (1-5 marketing lines, then column row)
// Columns: Date, Narration, Value Dt, Ref No./Cheque No., Withdrawal Amt., Deposit Amt., Closing Balance
export class HdfcCsvParser implements StatementParser {
  bank = 'hdfc_csv';

  canParse(file: ParsedFileMeta, firstBytes?: string): number {
    if (file.extension.toLowerCase() !== 'csv') return 0;
    if (!firstBytes) return 0;
    const upper = firstBytes.toUpperCase();
    if (upper.includes('HDFC') || upper.includes('WITHDRAWAL AMT') || upper.includes('CLOSING BALANCE')) {
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
    if (headerIdx === -1) throw new Error('HDFC CSV: cannot find column header row');

    const header = splitCsvLine(lines[headerIdx]).map(h => h.trim().toUpperCase());
    const col = {
      date: findCol(header, ['DATE']),
      narration: findCol(header, ['NARRATION', 'DESCRIPTION', 'PARTICULARS']),
      withdrawal: findCol(header, ['WITHDRAWAL AMT.', 'WITHDRAWAL AMT', 'WITHDRAWAL', 'DEBIT']),
      deposit: findCol(header, ['DEPOSIT AMT.', 'DEPOSIT AMT', 'DEPOSIT', 'CREDIT']),
      balance: findCol(header, ['CLOSING BALANCE', 'BALANCE']),
      refNo: findCol(header, ['REF NO./CHEQUE NO.', 'REF NO', 'CHQ NO', 'CHEQUE NO']),
    };

    if (col.date === -1 || col.narration === -1) {
      throw new Error('HDFC CSV: missing required columns (Date, Narration)');
    }

    const rows: RawTransaction[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      if (cols.length < 3) continue;
      const dateStr = cols[col.date]?.trim() ?? '';
      if (!dateStr || dateStr.toLowerCase() === 'date') continue;

      try {
        const txn_date = parseDate(dateStr);
        const narration = sanitizeNarration(cols[col.narration]?.trim() ?? '');
        if (!narration) continue;

        const withdrawal = col.withdrawal !== -1 ? parseIndianAmount(cols[col.withdrawal] ?? '') : 0;
        const deposit = col.deposit !== -1 ? parseIndianAmount(cols[col.deposit] ?? '') : 0;

        let amount: number;
        let direction: 'debit' | 'credit';
        if (withdrawal > 0) {
          amount = withdrawal;
          direction = 'debit';
        } else if (deposit > 0) {
          amount = deposit;
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
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const upper = lines[i].toUpperCase();
    if (upper.includes('DATE') && (upper.includes('NARRATION') || upper.includes('DESCRIPTION') || upper.includes('PARTICULARS'))) {
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
