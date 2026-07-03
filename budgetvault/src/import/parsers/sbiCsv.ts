import { ParsedFileMeta, RawTransaction, StatementParser } from '../../types';
import { parseDate, parseIndianAmount, sanitizeNarration } from '../normalize';

// SBI (State Bank of India) CSV format:
// Columns: Txn Date, Value Date, Description, Ref No./Cheque No., Debit, Credit, Balance
// SBI also exports with pipe (|) delimiters sometimes
export class SbiCsvParser implements StatementParser {
  bank = 'sbi_csv';

  canParse(file: ParsedFileMeta, firstBytes?: string): number {
    if (file.extension.toLowerCase() !== 'csv') return 0;
    if (!firstBytes) return 0;
    const upper = firstBytes.toUpperCase();
    if (upper.includes('STATE BANK') || upper.includes('SBI') ||
        (upper.includes('TXN DATE') && upper.includes('VALUE DATE'))) {
      return 0.9;
    }
    return 0;
  }

  async parse(fileContent: string | ArrayBuffer, _meta: ParsedFileMeta): Promise<RawTransaction[]> {
    const text = typeof fileContent === 'string'
      ? fileContent
      : new TextDecoder().decode(fileContent);

    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const { headerIdx, delimiter } = findHeaderLine(lines);
    if (headerIdx === -1) throw new Error('SBI CSV: cannot find column header row');

    const header = splitLine(lines[headerIdx], delimiter).map(h => h.trim().toUpperCase());
    const col = {
      date: findCol(header, ['TXN DATE', 'DATE', 'TRANSACTION DATE']),
      narration: findCol(header, ['DESCRIPTION', 'NARRATION', 'PARTICULARS', 'TRANSACTION DETAILS']),
      debit: findCol(header, ['DEBIT', 'WITHDRAWAL AMT', 'DR']),
      credit: findCol(header, ['CREDIT', 'DEPOSIT AMT', 'CR']),
      balance: findCol(header, ['BALANCE', 'CLOSING BALANCE']),
      refNo: findCol(header, ['REF NO./CHEQUE NO.', 'REF NO', 'CHEQUE NO', 'CHQ/REF NO']),
    };

    if (col.date === -1 || col.narration === -1) {
      throw new Error('SBI CSV: missing required columns (Date, Description)');
    }

    const rows: RawTransaction[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cols = splitLine(lines[i], delimiter);
      if (cols.length < 3) continue;
      const dateStr = cols[col.date]?.trim() ?? '';
      if (!dateStr || dateStr.toLowerCase() === 'txn date' || dateStr.toLowerCase() === 'date') continue;

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

function findHeaderLine(lines: string[]): { headerIdx: number; delimiter: string } {
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const upper = lines[i].toUpperCase();
    // SBI sometimes uses pipe delimiter
    const delimiter = upper.includes('|') ? '|' : ',';
    if ((upper.includes('TXN DATE') || upper.includes('DATE')) &&
        (upper.includes('DESCRIPTION') || upper.includes('NARRATION') || upper.includes('PARTICULARS'))) {
      return { headerIdx: i, delimiter };
    }
  }
  return { headerIdx: -1, delimiter: ',' };
}

function findCol(header: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = header.findIndex(h => h === c || h.startsWith(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

function splitLine(line: string, delimiter: string): string[] {
  if (delimiter === '|') {
    return line.split('|').map(s => s.trim());
  }
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
