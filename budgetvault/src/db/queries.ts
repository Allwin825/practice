import { SQLiteDatabase } from 'expo-sqlite';
import {
  Account,
  Category,
  Transaction,
  ImportBatch,
  Budget,
  BudgetActual,
  MonthlySpend,
} from '../types';

// --- Accounts ---

export async function getAccounts(db: SQLiteDatabase): Promise<Account[]> {
  return db.getAllAsync<Account>('SELECT * FROM accounts ORDER BY name');
}

export async function upsertAccount(
  db: SQLiteDatabase,
  account: Omit<Account, 'id' | 'last_txn_date'>
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO accounts (name, bank, kind) VALUES (?, ?, ?)',
    [account.name, account.bank, account.kind]
  );
  return result.lastInsertRowId;
}

export async function updateAccountWatermark(
  db: SQLiteDatabase,
  accountId: number,
  date: string
): Promise<void> {
  await db.runAsync(
    'UPDATE accounts SET last_txn_date = ? WHERE id = ? AND (last_txn_date IS NULL OR last_txn_date < ?)',
    [date, accountId, date]
  );
}

// --- Categories ---

export async function getCategories(db: SQLiteDatabase): Promise<Category[]> {
  return db.getAllAsync<Category>('SELECT * FROM categories ORDER BY kind, name');
}

// --- Transactions ---

export async function getTransactionsByMonth(
  db: SQLiteDatabase,
  month: string
): Promise<Transaction[]> {
  return db.getAllAsync<Transaction>(
    `SELECT t.*, c.name as category_name FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE strftime('%Y-%m', t.txn_date) = ?
     ORDER BY t.txn_date DESC, t.id DESC`,
    [month]
  );
}

export async function updateTransactionCategory(
  db: SQLiteDatabase,
  txnId: number,
  categoryId: number,
  source: 'manual'
): Promise<void> {
  await db.runAsync(
    'UPDATE transactions SET category_id = ?, category_source = ? WHERE id = ?',
    [categoryId, source, txnId]
  );
}

export async function getUncategorizedCount(db: SQLiteDatabase): Promise<number> {
  const result = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM transactions WHERE category_id IS NULL OR category_source = 'uncategorized'"
  );
  return result?.count ?? 0;
}

// --- Import Batches ---

export async function insertBatch(
  db: SQLiteDatabase,
  batch: Omit<ImportBatch, 'id'>
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO import_batches
       (account_id, file_name, imported_at, stmt_start, stmt_end, rows_in_file, rows_inserted, rows_skipped_dupe)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batch.account_id,
      batch.file_name,
      batch.imported_at,
      batch.stmt_start,
      batch.stmt_end,
      batch.rows_in_file,
      batch.rows_inserted,
      batch.rows_skipped_dupe,
    ]
  );
  return result.lastInsertRowId;
}

// --- Budget ---

export async function getBudgetsForMonth(
  db: SQLiteDatabase,
  month: string
): Promise<Budget[]> {
  return db.getAllAsync<Budget>(
    'SELECT * FROM budgets WHERE month = ?',
    [month]
  );
}

export async function upsertBudget(
  db: SQLiteDatabase,
  month: string,
  categoryId: number | null,
  amount: number
): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO budgets (month, category_id, planned_amount) VALUES (?, ?, ?)',
    [month, categoryId, amount]
  );
}

// --- Rollup queries ---

export async function getMonthlySpendByCategory(
  db: SQLiteDatabase,
  month: string
): Promise<MonthlySpend[]> {
  return db.getAllAsync<MonthlySpend>(
    `SELECT strftime('%Y-%m', t.txn_date) AS month, c.name AS category_name,
            SUM(CASE WHEN t.direction = 'debit' THEN t.amount ELSE 0 END) AS spent
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE strftime('%Y-%m', t.txn_date) = ?
     GROUP BY category_name
     ORDER BY spent DESC`,
    [month]
  );
}

export async function getBudgetActualsForMonth(
  db: SQLiteDatabase,
  month: string
): Promise<BudgetActual[]> {
  return db.getAllAsync<BudgetActual>(
    `SELECT b.month, b.category_id,
            COALESCE(c.name, 'Income') AS category_name,
            b.planned_amount,
            COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount ELSE 0 END), 0) AS actual_amount
     FROM budgets b
     LEFT JOIN categories c ON c.id = b.category_id
     LEFT JOIN transactions t
       ON strftime('%Y-%m', t.txn_date) = b.month
       AND t.category_id = b.category_id
     WHERE b.month = ?
     GROUP BY b.category_id
     ORDER BY actual_amount DESC`,
    [month]
  );
}

export async function getTotalSpendForMonth(
  db: SQLiteDatabase,
  month: string
): Promise<{ total_debit: number; total_credit: number }> {
  const result = await db.getFirstAsync<{ total_debit: number; total_credit: number }>(
    `SELECT
       SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) AS total_debit,
       SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) AS total_credit
     FROM transactions
     WHERE strftime('%Y-%m', txn_date) = ?`,
    [month]
  );
  return result ?? { total_debit: 0, total_credit: 0 };
}

// --- Settings ---

export async function getSetting(
  db: SQLiteDatabase,
  key: string
): Promise<string | null> {
  const result = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return result?.value ?? null;
}

export async function setSetting(
  db: SQLiteDatabase,
  key: string,
  value: string
): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value]
  );
}

// --- Trend / analytics ---

export interface TrendPoint {
  month: string;
  total_debit: number;
  total_credit: number;
}

export async function get6MonthTrend(db: SQLiteDatabase): Promise<TrendPoint[]> {
  return db.getAllAsync<TrendPoint>(
    `SELECT strftime('%Y-%m', txn_date) AS month,
            SUM(CASE WHEN direction = 'debit'  THEN amount ELSE 0 END) AS total_debit,
            SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) AS total_credit
     FROM transactions
     WHERE txn_date >= date('now', '-6 months')
     GROUP BY month
     ORDER BY month ASC`
  );
}

export async function copyBudgetsFromMonth(
  db: SQLiteDatabase,
  fromMonth: string,
  toMonth: string
): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO budgets (month, category_id, planned_amount)
     SELECT ?, category_id, planned_amount FROM budgets WHERE month = ?`,
    [toMonth, fromMonth]
  );
}

export async function hasImportThisWeek(db: SQLiteDatabase): Promise<boolean> {
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM import_batches
     WHERE date(imported_at) >= date('now', '-6 days')`
  );
  return (result?.count ?? 0) > 0;
}

export async function getImportHistory(
  db: SQLiteDatabase,
  limit = 10
): Promise<{ id: number; file_name: string | null; imported_at: string; rows_inserted: number; rows_skipped_dupe: number }[]> {
  return db.getAllAsync(
    `SELECT id, file_name, imported_at, rows_inserted, rows_skipped_dupe
     FROM import_batches ORDER BY imported_at DESC LIMIT ?`,
    [limit]
  );
}
