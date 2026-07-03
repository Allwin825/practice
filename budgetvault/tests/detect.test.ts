import { detectParser } from '../src/import/detect';
import { ParsedFileMeta } from '../src/types';

function meta(name: string, ext: string, size = 1024): ParsedFileMeta {
  return { name, extension: ext, size, uri: `/fake/${name}` };
}

describe('detectParser', () => {
  it('returns null for a completely unrecognised file type', () => {
    // .pdf has no registered parser → all scores 0
    const result = detectParser(meta('statement.pdf', 'pdf'));
    expect(result).toBeNull();
  });

  it('returns null for .txt extension', () => {
    const result = detectParser(meta('data.txt', 'txt'));
    expect(result).toBeNull();
  });

  it('falls back to generic_csv for an unknown CSV layout', () => {
    // generic_csv scores 0.3 for any .csv file; no bank-specific match
    const result = detectParser(meta('data.csv', 'csv'), 'col1,col2,col3\n1,2,3');
    expect(result).not.toBeNull();
    expect(result!.bank).toBe('generic_csv');
  });

  it('detects HDFC CSV by header bytes (score > generic)', () => {
    const hdfc = 'Date,Narration,Value Dat,Debit Amount,Credit Amount,Chq/Ref Number,Closing Balance';
    const result = detectParser(meta('hdfc.csv', 'csv'), hdfc);
    expect(result).not.toBeNull();
    expect(result!.bank).toBe('hdfc_csv');
  });

  it('detects ICICI CSV by header bytes', () => {
    const icici = 'Transaction Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance';
    const result = detectParser(meta('icici.csv', 'csv'), icici);
    expect(result).not.toBeNull();
    expect(result!.bank).toBe('icici_csv');
  });

  it('detects SBI CSV by header bytes', () => {
    const sbi = 'Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance';
    const result = detectParser(meta('sbi.csv', 'csv'), sbi);
    expect(result).not.toBeNull();
    expect(result!.bank).toBe('sbi_csv');
  });

  it('detects XLSX by file extension', () => {
    const result = detectParser(meta('statement.xlsx', 'xlsx'));
    expect(result).not.toBeNull();
    expect(result!.bank).toBe('generic_xlsx');
  });

  it('HDFC beats generic_csv when both could match .csv', () => {
    const hdfc = 'Date,Narration,Value Dat,Debit Amount,Credit Amount,Chq/Ref Number,Closing Balance';
    const result = detectParser(meta('statement.csv', 'csv'), hdfc);
    expect(result!.bank).toBe('hdfc_csv');
  });

  it('returns a parser with a canParse function', () => {
    const result = detectParser(meta('hdfc.csv', 'csv'),
      'Date,Narration,Value Dat,Debit Amount,Credit Amount,Chq/Ref Number,Closing Balance');
    expect(typeof result!.canParse).toBe('function');
    expect(typeof result!.parse).toBe('function');
  });
});
