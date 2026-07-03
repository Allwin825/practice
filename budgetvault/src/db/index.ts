import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  const db = await SQLite.openDatabaseAsync('budgetvault.db');
  try {
    await runMigrations(db);
  } catch (err) {
    await db.closeAsync();
    throw err;
  }
  _db = db;
  return _db;
}

export { SQLite };
