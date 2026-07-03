// Real SQLite integration tests using better-sqlite3.
// These run migrations, the import/commit pipeline, and dedup invariants against
// an actual in-memory database without any expo-sqlite mocks.

import Database from 'better-sqlite3';
import { runMigrations } from '../src/db/migrations';
import { commitReviewRows } from '../src/import/commit';
import type { ReviewRow } from '../src/types';

// Wrap better-sqlite3 (synchronous) in the expo-sqlite async API shape so
// existing src/ modules work unmodified.
function makeSQLiteAdapter(db: Database.Database) {
  return {
    execAsync: async (sql: string) => { db.exec(sql); },
    getFirstAsync: async <T>(sql: string, params: unknown[] = []) =>
      ((params.length ? db.prepare(sql).get(params) : db.prepare(sql).get()) ?? null) as T | null,
    getAllAsync: async <T>(sql: string, params: unknown[] = []) =>
      (params.length ? db.prepare(sql).all(params) : db.prepare(sql).all()) as T[],
    runAsync: async (sql: string, params: unknown[] = []) => {
      const res = params.length ? db.prepare(sql).run(params) : db.prepare(sql).run();
      return { lastInsertRowId: Number(res.lastInsertRowid), changes: res.changes };
    },
    withTransactionAsync: async (fn: () => Promise<void>) => {
      db.exec('BEGIN');
      try {
        await fn();
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

type Adapter = ReturnType<typeof makeSQLiteAdapter>;

function makeRow(overrides: Partial<ReviewRow> = {}): ReviewRow {
  return {
    txn_date: '2024-01-15',
    narration: 'AMAZON PAY UPI TXN',
    amount: 299.00,
    direction: 'debit',
    balance_after: 10000.00,
    ref_no: 'UPI12345',
    is_dupe: false,
    skip: false,
    intra_day_ordinal: 0,
    suggested_category_id: null,
    category_source: 'uncategorized',
    txn_hash: 'placeholder',
    ...overrides,
  };
}

function count(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

describe('real SQLite — migrations', () => {
  let db: Database.Database;
  let adapter: Adapter;

  beforeEach(async () => {
    db = new Database(':memory:');
    adapter = makeSQLiteAdapter(db);
    await runMigrations(adapter as any);
  });

  afterEach(() => db.close());

  it('creates schema at version 2 on a fresh-install', () => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'schema_version'")
      .get() as { value: string };
    expect(row?.value).toBe('2');
  });

  it('creates all required tables', () => {
    const tables = (db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[]).map(r => r.name);
    for (const t of ['accounts', 'budgets', 'categories', 'category_rules',
                     'import_batches', 'settings', 'transactions']) {
      expect(tables).toContain(t);
    }
  });

  it('seeds default categories on first run', () => {
    const n = count(db, 'categories');
    expect(n).toBeGreaterThan(0);
  });

  it('seeds default category_rules on first run', () => {
    const n = count(db, 'category_rules');
    expect(n).toBeGreaterThan(0);
  });

  it('is idempotent — running migrations twice does not duplicate seed data', async () => {
    const beforeCats = count(db, 'categories');
    await runMigrations(adapter as any);
    const afterCats = count(db, 'categories');
    expect(afterCats).toBe(beforeCats);
  });
});

describe('real SQLite — import pipeline (paise storage)', () => {
  let db: Database.Database;
  let adapter: Adapter;

  beforeEach(async () => {
    db = new Database(':memory:');
    adapter = makeSQLiteAdapter(db);
    await runMigrations(adapter as any);
    db.prepare(
      "INSERT INTO accounts (id, name, bank, kind) VALUES (1, 'HDFC', 'hdfc_csv', 'bank')"
    ).run();
  });

  afterEach(() => db.close());

  it('stores transaction amounts as integer paise (× 100)', async () => {
    const result = await commitReviewRows(adapter as any, 1, [makeRow({ amount: 299.00 })], 'test.csv', null, null);
    expect(result.inserted).toBe(1);
    const txn = db.prepare('SELECT amount, balance_after FROM transactions LIMIT 1').get() as any;
    expect(txn.amount).toBe(29900);
    expect(txn.balance_after).toBe(1000000);
  });

  it('stores fractional rupee amounts correctly (₹1299.50 → 129950p)', async () => {
    await commitReviewRows(adapter as any, 1, [makeRow({ amount: 1299.50, balance_after: 0 })], 'f.csv', null, null);
    const txn = db.prepare('SELECT amount FROM transactions LIMIT 1').get() as any;
    expect(txn.amount).toBe(129950);
  });

  it('inserts a batch record alongside transaction rows', async () => {
    expect(count(db, 'import_batches')).toBe(0);
    await commitReviewRows(adapter as any, 1, [makeRow()], 'test.csv', null, null);
    expect(count(db, 'import_batches')).toBe(1);
  });
});

describe('real SQLite — dedup invariant', () => {
  let db: Database.Database;
  let adapter: Adapter;

  beforeEach(async () => {
    db = new Database(':memory:');
    adapter = makeSQLiteAdapter(db);
    await runMigrations(adapter as any);
    db.prepare(
      "INSERT INTO accounts (id, name, bank, kind) VALUES (1, 'HDFC', 'hdfc_csv', 'bank')"
    ).run();
  });

  afterEach(() => db.close());

  it('imports 0 rows and skips 1 when re-importing the same statement', async () => {
    const row = makeRow();
    const r1 = await commitReviewRows(adapter as any, 1, [row], 'test.csv', null, null);
    expect(r1.inserted).toBe(1);

    const r2 = await commitReviewRows(adapter as any, 1, [row], 'test.csv', null, null);
    expect(r2.inserted).toBe(0);
    expect(r2.skipped).toBe(1);
    expect(count(db, 'transactions')).toBe(1);
  });

  it('imports distinct rows even on the same date (different ordinal)', async () => {
    const r1 = makeRow({ narration: 'SWIGGY', intra_day_ordinal: 0 });
    const r2 = makeRow({ narration: 'SWIGGY', intra_day_ordinal: 1 });
    const result = await commitReviewRows(adapter as any, 1, [r1, r2], 'test.csv', null, null);
    expect(result.inserted).toBe(2);
    expect(count(db, 'transactions')).toBe(2);
  });

  it('rows pre-marked as is_dupe are skipped without a DB insert', async () => {
    const row = makeRow({ is_dupe: true });
    const result = await commitReviewRows(adapter as any, 1, [row], 'test.csv', null, null);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(count(db, 'transactions')).toBe(0);
  });
});

describe('real SQLite — transactional rollback', () => {
  let db: Database.Database;
  let adapter: Adapter;

  beforeEach(async () => {
    db = new Database(':memory:');
    adapter = makeSQLiteAdapter(db);
    await runMigrations(adapter as any);
    db.prepare(
      "INSERT INTO accounts (id, name, bank, kind) VALUES (1, 'HDFC', 'hdfc_csv', 'bank')"
    ).run();
  });

  afterEach(() => db.close());

  it('rolls back import_batches and transactions on a non-UNIQUE error', async () => {
    let txnInsertCount = 0;
    const originalRunAsync = adapter.runAsync.bind(adapter);
    adapter.runAsync = async (sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT INTO transactions')) {
        txnInsertCount++;
        if (txnInsertCount === 1) {
          throw new Error('SQLITE_FULL: database or disk is full');
        }
      }
      return originalRunAsync(sql, params ?? []);
    };

    const rows = [
      makeRow({ intra_day_ordinal: 0 }),
      makeRow({ narration: 'SWIGGY', intra_day_ordinal: 1 }),
    ];

    await expect(
      commitReviewRows(adapter as any, 1, rows, 'test.csv', null, null)
    ).rejects.toThrow('SQLITE_FULL');

    expect(count(db, 'transactions')).toBe(0);
    expect(count(db, 'import_batches')).toBe(0);
  });

  it('a successful batch after a failed batch still inserts correctly', async () => {
    // First batch: fails
    let fail = true;
    const originalRunAsync = adapter.runAsync.bind(adapter);
    adapter.runAsync = async (sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT INTO transactions') && fail) {
        fail = false;
        throw new Error('SQLITE_FULL');
      }
      return originalRunAsync(sql, params ?? []);
    };

    await expect(
      commitReviewRows(adapter as any, 1, [makeRow()], 'test.csv', null, null)
    ).rejects.toThrow();

    expect(count(db, 'transactions')).toBe(0);

    // Second batch: succeeds
    const result = await commitReviewRows(adapter as any, 1, [makeRow({ narration: 'NETFLIX' })], 'b.csv', null, null);
    expect(result.inserted).toBe(1);
    expect(count(db, 'transactions')).toBe(1);
  });
});
