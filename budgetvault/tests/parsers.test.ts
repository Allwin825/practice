import { HdfcCsvParser } from '../src/import/parsers/hdfcCsv';
import { IciciBankCsvParser } from '../src/import/parsers/iciciBankCsv';
import { SbiCsvParser } from '../src/import/parsers/sbiCsv';
import { GenericCsvParser } from '../src/import/parsers/genericCsv';
import type { ParsedFileMeta } from '../src/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const HDFC_CSV = `Date,Narration,Value Dt,Ref No./Cheque No.,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/06/2025,UPI-SWIGGY-PAY@ICICI,01/06/2025,123456789012345,450.00,,49550.00
02/06/2025,SALARY CREDIT,02/06/2025,987654321098765,,80000.00,129550.00
03/06/2025,ATM WITHDRAWAL,03/06/2025,000000000000001,2000.00,,127550.00
`;

const HDFC_CSV_WITH_HEADERS = `HDFC Bank Statement
Account No: 1234567890
Period: 01-Jun-2025 To 30-Jun-2025
Date,Narration,Value Dt,Ref No./Cheque No.,Withdrawal Amt.,Deposit Amt.,Closing Balance
10/06/2025,POS AMAZON,10/06/2025,ABC123,1299.00,,48251.00
15/06/2025,NEFT CREDIT FROM XYZ,15/06/2025,NEFT001,,5000.00,53251.00
`;

const ICICI_CSV = `Transaction Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance
01-Jun-2025,01-Jun-2025,UPI/ZOMATO/FOOD,UPI123456,350.00,,99650.00
05-Jun-2025,05-Jun-2025,SALARY,SAL20250605,,50000.00,149650.00
10-Jun-2025,10-Jun-2025,EMI PAYMENT,EMI001,12000.00,,137650.00
`;

const ICICI_CSV_WITH_HEADERS = `ICICI Bank Limited
Account Statement
From: 01/06/2025 To: 30/06/2025
Transaction Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance
20-Jun-2025,20-Jun-2025,ELECTRICITY BILL,BBPS001,2500.00,,135150.00
`;

const SBI_CSV = `Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance
01/06/2025,01/06/2025,UPI PAYMENT PAYTM,UPI789012,200.00,,29800.00
07/06/2025,07/06/2025,GOVT SALARY,SAL001,,45000.00,74800.00
15/06/2025,15/06/2025,LIC PREMIUM,LIC001,3500.00,,71300.00
`;

const SBI_PIPE_CSV = `Txn Date|Value Date|Description|Ref No./Cheque No.|Debit|Credit|Balance
01/06/2025|01/06/2025|UPI PAYMENT PAYTM|UPI789012|200.00||29800.00
07/06/2025|07/06/2025|GOVT SALARY|SAL001||45000.00|74800.00
`;

const mockMeta = (name: string): ParsedFileMeta => ({
  name,
  extension: name.split('.').pop() ?? 'csv',
  size: 1000,
  uri: `file:///test/${name}`,
});

// ── HDFC parser tests ─────────────────────────────────────────────────────────

describe('HdfcCsvParser', () => {
  const parser = new HdfcCsvParser();

  test('canParse returns high confidence for HDFC CSV', () => {
    const score = parser.canParse(mockMeta('statement.csv'), HDFC_CSV);
    expect(score).toBeGreaterThanOrEqual(0.8);
  });

  test('canParse returns 0 for non-CSV', () => {
    const score = parser.canParse(mockMeta('file.xlsx'));
    expect(score).toBe(0);
  });

  test('parses basic HDFC CSV with 3 transactions', async () => {
    const rows = await parser.parse(HDFC_CSV, mockMeta('statement.csv'));
    expect(rows).toHaveLength(3);
  });

  test('parses debit transaction correctly', async () => {
    const rows = await parser.parse(HDFC_CSV, mockMeta('statement.csv'));
    const swiggy = rows[0];
    expect(swiggy.direction).toBe('debit');
    expect(swiggy.amount).toBe(450);
    expect(swiggy.txn_date).toBe('2025-06-01');
    expect(swiggy.narration).toContain('SWIGGY');
  });

  test('parses credit transaction correctly', async () => {
    const rows = await parser.parse(HDFC_CSV, mockMeta('statement.csv'));
    const salary = rows[1];
    expect(salary.direction).toBe('credit');
    expect(salary.amount).toBe(80000);
  });

  test('parses HDFC CSV with marketing header rows', async () => {
    const rows = await parser.parse(HDFC_CSV_WITH_HEADERS, mockMeta('statement.csv'));
    expect(rows).toHaveLength(2);
    expect(rows[0].direction).toBe('debit');
    expect(rows[0].amount).toBe(1299);
  });

  test('captures balance_after', async () => {
    const rows = await parser.parse(HDFC_CSV, mockMeta('statement.csv'));
    expect(rows[0].balance_after).toBe(49550);
  });
});

// ── ICICI parser tests ────────────────────────────────────────────────────────

describe('IciciBankCsvParser', () => {
  const parser = new IciciBankCsvParser();

  test('canParse returns high confidence for ICICI CSV', () => {
    const score = parser.canParse(mockMeta('statement.csv'), ICICI_CSV);
    expect(score).toBeGreaterThanOrEqual(0.8);
  });

  test('parses 3 ICICI transactions', async () => {
    const rows = await parser.parse(ICICI_CSV, mockMeta('statement.csv'));
    expect(rows).toHaveLength(3);
  });

  test('parses ICICI date format DD-Mon-YYYY', async () => {
    const rows = await parser.parse(ICICI_CSV, mockMeta('statement.csv'));
    expect(rows[0].txn_date).toBe('2025-06-01');
  });

  test('parses ICICI CSV with header rows', async () => {
    const rows = await parser.parse(ICICI_CSV_WITH_HEADERS, mockMeta('statement.csv'));
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(2500);
    expect(rows[0].direction).toBe('debit');
  });

  test('large amounts parsed correctly (₹1,23,456)', async () => {
    const csv = `Transaction Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance\n01-Jun-2025,01-Jun-2025,NEFT TRANSFER,,,"1,23,456.00",1234560.00\n`;
    const rows = await parser.parse(csv, mockMeta('statement.csv'));
    expect(rows[0].amount).toBe(123456);
    expect(rows[0].direction).toBe('credit');
  });
});

// ── SBI parser tests ──────────────────────────────────────────────────────────

describe('SbiCsvParser', () => {
  const parser = new SbiCsvParser();

  test('canParse returns high confidence for SBI CSV', () => {
    const score = parser.canParse(mockMeta('statement.csv'), SBI_CSV);
    expect(score).toBeGreaterThanOrEqual(0.8);
  });

  test('parses comma-delimited SBI CSV', async () => {
    const rows = await parser.parse(SBI_CSV, mockMeta('statement.csv'));
    expect(rows).toHaveLength(3);
  });

  test('parses pipe-delimited SBI CSV', async () => {
    const rows = await parser.parse(SBI_PIPE_CSV, mockMeta('statement.csv'));
    expect(rows).toHaveLength(2);
  });

  test('salary is parsed as credit', async () => {
    const rows = await parser.parse(SBI_CSV, mockMeta('statement.csv'));
    const salary = rows.find((r) => r.narration.includes('SALARY'));
    expect(salary?.direction).toBe('credit');
    expect(salary?.amount).toBe(45000);
  });
});

// ── Parser priority test ──────────────────────────────────────────────────────

describe('Parser detection priority', () => {
  test('HDFC parser scores higher than generic for HDFC CSV', () => {
    const hdfc = new HdfcCsvParser();
    const generic = new GenericCsvParser();
    const meta = mockMeta('statement.csv');
    expect(hdfc.canParse(meta, HDFC_CSV)).toBeGreaterThan(generic.canParse(meta));
  });

  test('ICICI parser scores higher than generic for ICICI CSV', () => {
    const icici = new IciciBankCsvParser();
    const generic = new GenericCsvParser();
    const meta = mockMeta('statement.csv');
    expect(icici.canParse(meta, ICICI_CSV)).toBeGreaterThan(generic.canParse(meta));
  });
});

// ── Indian amount format tests ────────────────────────────────────────────────

describe('Indian amount edge cases', () => {
  test('parses amount with Indian grouping (1,23,456.78)', async () => {
    const csv = `Date,Narration,Value Dt,Ref No./Cheque No.,Withdrawal Amt.,Deposit Amt.,Closing Balance\n01/06/2025,TEST,,,"1,23,456.78",,0\n`;
    const parser = new HdfcCsvParser();
    const rows = await parser.parse(csv, mockMeta('statement.csv'));
    expect(rows[0].amount).toBeCloseTo(123456.78);
  });

  test('skips rows with zero amount', async () => {
    const csv = `Date,Narration,Value Dt,Ref No./Cheque No.,Withdrawal Amt.,Deposit Amt.,Closing Balance\n01/06/2025,ZERO ROW,,,,0,100\n`;
    const parser = new HdfcCsvParser();
    const rows = await parser.parse(csv, mockMeta('statement.csv'));
    expect(rows).toHaveLength(0);
  });

  test('skips rows with empty date', async () => {
    const csv = `Date,Narration,Value Dt,Ref No./Cheque No.,Withdrawal Amt.,Deposit Amt.,Closing Balance\n,EMPTY DATE ROW,,,100,,0\n`;
    const parser = new HdfcCsvParser();
    const rows = await parser.parse(csv, mockMeta('statement.csv'));
    expect(rows).toHaveLength(0);
  });
});
