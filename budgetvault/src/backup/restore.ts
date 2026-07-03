import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import type { SQLiteDatabase } from 'expo-sqlite';

export interface RestoreResult {
  tablesRestored: string[];
  rowCounts: Record<string, number>;
}

// Whitelist of allowed columns per table — guards against SQL-injection via
// attacker-controlled column names in a crafted backup file (fix M-3).
const TABLE_COLUMNS: Record<string, ReadonlySet<string>> = {
  settings: new Set(['key', 'value']),
  accounts: new Set(['id', 'name', 'bank', 'kind', 'last_txn_date']),
  categories: new Set(['id', 'name', 'kind', 'icon', 'color', 'is_system']),
  category_rules: new Set(['id', 'pattern', 'category_id', 'priority', 'source']),
  import_batches: new Set([
    'id', 'account_id', 'file_name', 'imported_at',
    'stmt_start', 'stmt_end', 'rows_in_file', 'rows_inserted', 'rows_skipped_dupe',
  ]),
  transactions: new Set([
    'id', 'account_id', 'batch_id', 'txn_date', 'narration', 'ref_no',
    'amount', 'direction', 'balance_after', 'category_id', 'category_source',
    'txn_hash', 'notes',
  ]),
  budgets: new Set(['id', 'month', 'category_id', 'planned_amount']),
};

const RESTORE_ORDER = [
  'settings',
  'accounts',
  'categories',
  'category_rules',
  'import_batches',
  'transactions',
  'budgets',
] as const;

export async function restoreFromBackup(db: SQLiteDatabase): Promise<RestoreResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    throw new Error('No file selected.');
  }

  const asset = result.assets[0];
  const content = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  let backup: Record<string, unknown[]>;
  try {
    backup = JSON.parse(content);
  } catch {
    throw new Error('Invalid backup file: not valid JSON.');
  }

  validateBackup(backup);

  const rowCounts: Record<string, number> = {};
  const tablesRestored: string[] = [];

  await db.withTransactionAsync(async () => {
    for (const table of RESTORE_ORDER) {
      const rows = backup[table];
      if (!rows || !Array.isArray(rows) || rows.length === 0) continue;

      const allowedCols = TABLE_COLUMNS[table];

      await db.runAsync(`DELETE FROM ${table}`);

      for (const row of rows) {
        if (typeof row !== 'object' || row === null) continue;
        const r = row as Record<string, unknown>;

        // Only insert known columns — drop any unknown keys silently.
        const cols = Object.keys(r).filter(c => allowedCols.has(c));
        if (cols.length === 0) continue;

        const placeholders = cols.map(() => '?').join(', ');
        const values = cols.map(c => r[c]);
        await db.runAsync(
          `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
          values as (string | number | null)[]
        );
      }

      tablesRestored.push(table);
      rowCounts[table] = rows.length;
    }
  });

  return { tablesRestored, rowCounts };
}

function validateBackup(data: Record<string, unknown[]>): void {
  const knownTables = new Set(Object.keys(TABLE_COLUMNS));
  const keys = Object.keys(data);
  if (keys.length === 0) throw new Error('Backup file is empty.');
  if (!keys.some(k => knownTables.has(k))) {
    throw new Error('Backup file does not appear to be a valid BudgetVault backup.');
  }
  for (const key of keys) {
    if (!Array.isArray(data[key])) {
      throw new Error(`Invalid backup format: "${key}" should be an array.`);
    }
  }
}
