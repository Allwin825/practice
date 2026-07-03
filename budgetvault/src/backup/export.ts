import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

export type ExportFormat = 'json' | 'csv';

export async function exportData(db: SQLiteDatabase, format: ExportFormat): Promise<void> {
  const isSharingAvailable = await Sharing.isAvailableAsync();
  if (!isSharingAvailable) {
    throw new Error('Sharing is not available on this device.');
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const fileName = `budgetvault-backup-${timestamp}.${format}`;
  const filePath = `${FileSystem.cacheDirectory}${fileName}`;

  if (format === 'json') {
    const data = await collectAllData(db);
    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } else {
    const csv = await buildTransactionCsv(db);
    await FileSystem.writeAsStringAsync(filePath, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  try {
    await Sharing.shareAsync(filePath, {
      mimeType: format === 'json' ? 'application/json' : 'text/csv',
      dialogTitle: `Export BudgetVault ${format.toUpperCase()}`,
      UTI: format === 'json' ? 'public.json' : 'public.comma-separated-values-text',
    });
  } finally {
    // Always remove the cache copy — plaintext backups must not linger (fix M-1).
    await FileSystem.deleteAsync(filePath, { idempotent: true }).catch(() => {});
  }
}

async function collectAllData(db: SQLiteDatabase): Promise<Record<string, unknown[]>> {
  const tables = ['accounts', 'categories', 'category_rules', 'import_batches', 'transactions', 'budgets', 'settings'];
  const result: Record<string, unknown[]> = {};
  for (const table of tables) {
    result[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
  }
  return result;
}

async function buildTransactionCsv(db: SQLiteDatabase): Promise<string> {
  const rows = await db.getAllAsync<{
    txn_date: string;
    narration: string;
    amount: number;
    direction: string;
    balance_after: number | null;
    ref_no: string | null;
    category_name: string | null;
    account_name: string | null;
    notes: string | null;
  }>(`
    SELECT
      t.txn_date, t.narration, t.amount, t.direction,
      t.balance_after, t.ref_no,
      c.name AS category_name,
      a.name AS account_name,
      t.notes
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN accounts a ON a.id = t.account_id
    ORDER BY t.txn_date DESC, t.id DESC
  `);

  const header = 'Date,Narration,Amount,Direction,Balance,Ref No,Category,Account,Notes\n';
  const lines = rows.map(r =>
    [
      r.txn_date,
      csvQuote(formulaGuard(r.narration)),
      (r.amount / 100).toFixed(2),
      r.direction,
      r.balance_after != null ? (r.balance_after / 100).toFixed(2) : '',
      csvQuote(formulaGuard(r.ref_no ?? '')),
      csvQuote(formulaGuard(r.category_name ?? '')),
      csvQuote(formulaGuard(r.account_name ?? '')),
      csvQuote(formulaGuard(r.notes ?? '')),
    ].join(',')
  );
  return header + lines.join('\n');
}

// Prefix cells that start with formula-trigger characters so spreadsheets
// don't execute them as formulas (fix M-2).
function formulaGuard(s: string): string {
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  return s;
}

function csvQuote(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
