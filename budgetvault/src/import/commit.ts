import { SQLiteDatabase } from 'expo-sqlite';
import { ReviewRow } from '../types';
import { computeTxnHashAsync } from './dedup';
import { updateAccountWatermark, insertBatch } from '../db/queries';

export interface CommitResult {
  inserted: number;
  skipped: number;
  batchId: number;
}

export async function commitReviewRows(
  db: SQLiteDatabase,
  accountId: number,
  rows: ReviewRow[],
  fileName: string | null,
  stmtStart: string | null,
  stmtEnd: string | null
): Promise<CommitResult> {
  const toInsert = rows.filter((r) => !r.skip && !r.is_dupe);
  const skipped = rows.length - toInsert.length;
  let inserted = 0;
  let batchId = 0;

  await db.withTransactionAsync(async () => {
    batchId = await insertBatch(db, {
      account_id: accountId,
      file_name: fileName,
      imported_at: new Date().toISOString(),
      stmt_start: stmtStart,
      stmt_end: stmtEnd,
      rows_in_file: rows.length,
      rows_inserted: 0,
      rows_skipped_dupe: skipped,
    });

    for (const row of toInsert) {
      const hash = await computeTxnHashAsync(accountId, row, row.intra_day_ordinal);
      try {
        await db.runAsync(
          `INSERT INTO transactions
             (account_id, batch_id, txn_date, narration, ref_no, amount, direction,
              balance_after, category_id, category_source, txn_hash, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            accountId,
            batchId,
            row.txn_date,
            row.narration,
            row.ref_no ?? null,
            row.amount,
            row.direction,
            row.balance_after ?? null,
            row.suggested_category_id,
            row.category_source,
            hash,
            null,
          ]
        );
        inserted++;
      } catch {
        // UNIQUE constraint → already stored, count as skipped
      }
    }

    await db.runAsync(
      'UPDATE import_batches SET rows_inserted = ? WHERE id = ?',
      [inserted, batchId]
    );

    if (toInsert.length > 0) {
      const latestDate = toInsert
        .map((r) => r.txn_date)
        .sort()
        .reverse()[0];
      await updateAccountWatermark(db, accountId, latestDate);
    }
  });

  return { inserted, skipped, batchId };
}
