// Integration tests that verify the critical post-v1.0.0 fixes:
//   5.1 — migrations bootstrap `settings` before reading schema_version
//   6.2 — commit only swallows UNIQUE constraint violations

import { runMigrations } from '../src/db/migrations';
import { commitReviewRows } from '../src/import/commit';
import { SCHEMA_VERSION } from '../src/db/schema';
import type { ReviewRow } from '../src/types';

jest.mock('../src/db/queries', () => ({
  insertBatch: jest.fn().mockResolvedValue(1),
  updateAccountWatermark: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/import/dedup', () => ({
  computeTxnHash: jest.fn().mockResolvedValue('deadbeef1234cafebabe'),
}));

function makeRow(overrides: Partial<ReviewRow> = {}): ReviewRow {
  return {
    txn_date: '2024-01-15',
    narration: 'Test Transaction',
    amount: 500,
    direction: 'debit',
    is_dupe: false,
    skip: false,
    intra_day_ordinal: 0,
    suggested_category_id: null,
    category_source: 'uncategorized',
    txn_hash: '',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 5.1 — fresh-install bootstrap
// ---------------------------------------------------------------------------
describe('runMigrations — fresh-install bootstrap (fix 5.1)', () => {
  it('creates the settings table before querying schema_version', async () => {
    const callOrder: string[] = [];

    const db = {
      execAsync: jest.fn(async (sql: string) => {
        if (/CREATE TABLE IF NOT EXISTS settings/i.test(sql)) {
          callOrder.push('create_settings');
        }
      }),
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes('schema_version')) {
          callOrder.push('read_schema_version');
          return null; // simulate fresh install — no version stored yet
        }
        if (sql.includes('COUNT(*)')) return { count: 0 };
        return null;
      }),
      runAsync: jest.fn(),
      withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
    } as any;

    await runMigrations(db);

    const createIdx = callOrder.indexOf('create_settings');
    const readIdx = callOrder.indexOf('read_schema_version');

    expect(createIdx).toBeGreaterThanOrEqual(0); // bootstrap CREATE was called
    expect(readIdx).toBeGreaterThanOrEqual(0);   // schema_version was read
    expect(createIdx).toBeLessThan(readIdx);      // CREATE precedes SELECT
  });

  it('is a no-op when schema_version already matches SCHEMA_VERSION', async () => {
    const db = {
      execAsync: jest.fn(),
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes('schema_version')) return { value: String(SCHEMA_VERSION) }; // already migrated
        return null;
      }),
      runAsync: jest.fn(),
      withTransactionAsync: jest.fn(),
    } as any;

    await runMigrations(db);

    expect(db.withTransactionAsync).not.toHaveBeenCalled();
  });

  it('runs the full migration transaction on version 0', async () => {
    const db = {
      execAsync: jest.fn(),
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes('schema_version')) return null; // fresh
        if (sql.includes('COUNT(*)')) return { count: 0 };
        return null;
      }),
      runAsync: jest.fn(),
      withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
    } as any;

    await runMigrations(db);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    // After migration, schema_version should be written
    const calls: string[] = db.runAsync.mock.calls.map(([sql]: [string]) => sql);
    expect(calls.some(s => s.includes('schema_version'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6.2 — commit error propagation
// ---------------------------------------------------------------------------
describe('commitReviewRows — UNIQUE error handling (fix 6.2)', () => {
  it('propagates non-UNIQUE insert errors and aborts the import', async () => {
    const diskFull = new Error('SQLITE_FULL: database or disk is full');

    const db = {
      runAsync: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO transactions')) throw diskFull;
        return Promise.resolve({ lastInsertRowId: 1 });
      }),
      withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
    } as any;

    const rows = [makeRow()];
    await expect(commitReviewRows(db, 1, rows, null, null, null))
      .rejects.toThrow('SQLITE_FULL');
  });

  it('counts runtime UNIQUE violations as skipped without throwing', async () => {
    const uniqueErr = new Error(
      'UNIQUE constraint failed: transactions.account_id, transactions.txn_hash'
    );

    const db = {
      runAsync: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO transactions')) throw uniqueErr;
        return Promise.resolve({ lastInsertRowId: 1 });
      }),
      withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
    } as any;

    const rows = [makeRow(), makeRow({ narration: 'Another' })];
    const result = await commitReviewRows(db, 1, rows, null, null, null);

    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(2); // both UNIQUE-violated
  });

  it('tracks mixed inserts and UNIQUE dupes correctly', async () => {
    let insertCount = 0;
    const uniqueErr = new Error('UNIQUE constraint failed: transactions.account_id, transactions.txn_hash');

    const db = {
      runAsync: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO transactions')) {
          insertCount++;
          if (insertCount % 2 === 0) throw uniqueErr; // every second row is a dupe
        }
        return Promise.resolve({ lastInsertRowId: 1 });
      }),
      withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
    } as any;

    const rows = [makeRow(), makeRow({ narration: 'B' }), makeRow({ narration: 'C' }), makeRow({ narration: 'D' })];
    const result = await commitReviewRows(db, 1, rows, null, null, null);

    expect(result.inserted).toBe(2);
    expect(result.skipped).toBe(2);
  });

  it('does not attempt to insert rows already marked as is_dupe', async () => {
    const db = {
      runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1 }),
      withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
    } as any;

    const rows = [makeRow({ is_dupe: true }), makeRow({ is_dupe: true })];
    const result = await commitReviewRows(db, 1, rows, null, null, null);

    const txnInserts = (db.runAsync.mock.calls as [string][])
      .filter(([sql]) => sql.includes('INSERT INTO transactions'));
    expect(txnInserts).toHaveLength(0);
    expect(result.skipped).toBe(2);
  });

  it('does not attempt to insert rows marked as skip', async () => {
    const db = {
      runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1 }),
      withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
    } as any;

    const rows = [makeRow({ skip: true }), makeRow()];
    const result = await commitReviewRows(db, 1, rows, null, null, null);

    const txnInserts = (db.runAsync.mock.calls as [string][])
      .filter(([sql]) => sql.includes('INSERT INTO transactions'));
    expect(txnInserts).toHaveLength(1); // only the non-skipped row
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
  });
});
