import { SQLiteDatabase } from 'expo-sqlite';
import { CategoryRule, CategorySource, RawTransaction, ReviewRow } from '../types';
import { computeTxnHash } from '../import/dedup';

let _rulesCache: CategoryRule[] | null = null;

export async function loadRules(db: SQLiteDatabase): Promise<CategoryRule[]> {
  if (_rulesCache) return _rulesCache;
  _rulesCache = await db.getAllAsync<CategoryRule>(
    'SELECT * FROM category_rules ORDER BY priority ASC, source DESC'
  );
  return _rulesCache;
}

export function invalidateRulesCache(): void {
  _rulesCache = null;
}

export function categorize(
  narration: string,
  rules: CategoryRule[]
): { categoryId: number | null; source: CategorySource } {
  const upper = narration.toUpperCase();
  for (const rule of rules) {
    if (upper.includes(rule.pattern.toUpperCase())) {
      const source: CategorySource =
        rule.source === 'seed' ? 'rule' :
        rule.source === 'learned' ? 'learned' : 'rule';
      return { categoryId: rule.category_id, source };
    }
  }
  return { categoryId: null, source: 'uncategorized' };
}

export async function buildReviewRows(
  db: SQLiteDatabase,
  accountId: number,
  rawTxns: RawTransaction[]
): Promise<ReviewRow[]> {
  const rules = await loadRules(db);

  const rows: ReviewRow[] = [];
  const intraDayCounters: Map<string, number> = new Map();

  for (const txn of rawTxns) {
    const baseKey = `${txn.txn_date}|${txn.amount}|${txn.direction}|${txn.narration}|${txn.ref_no ?? ''}|${txn.balance_after ?? ''}`;
    const ordinal = intraDayCounters.get(baseKey) ?? 0;
    intraDayCounters.set(baseKey, ordinal + 1);

    const txn_hash = computeTxnHash(accountId, txn, ordinal);

    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM transactions WHERE account_id = ? AND txn_hash = ?',
      [accountId, txn_hash]
    );

    const { categoryId, source } = categorize(txn.narration, rules);

    rows.push({
      ...txn,
      suggested_category_id: categoryId,
      category_source: source,
      skip: existing !== null,
      txn_hash,
      is_dupe: existing !== null,
      intra_day_ordinal: ordinal,
    });
  }

  return rows;
}

export async function saveLearntRule(
  db: SQLiteDatabase,
  merchantToken: string,
  categoryId: number
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO category_rules (pattern, category_id, priority, source)
     VALUES (?, ?, 50, 'learned')`,
    [merchantToken.toUpperCase(), categoryId]
  );
  invalidateRulesCache();
}
