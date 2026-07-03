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
  // Use cacheDirectory so expo-sharing can access it on Android
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

  await Sharing.shareAsync(filePath, {
    mimeType: format === 'json' ? 'application/json' : 'text/csv',
    dialogTitle: `Export BudgetVault ${format.toUpperCase()}`,
    UTI: format === 'json' ? 'public.json' : 'public.comma-separated-values-text',
  });
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
      csvQuote(r.narration),
      r.amount.toFixed(2),
      r.direction,
      r.balance_after != null ? r.balance_after.toFixed(2) : '',
      csvQuote(r.ref_no ?? ''),
      csvQuote(r.category_name ?? ''),
      csvQuote(r.account_name ?? ''),
      csvQuote(r.notes ?? ''),
    ].join(',')
  );
  return header + lines.join('\n');
}

function csvQuote(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
