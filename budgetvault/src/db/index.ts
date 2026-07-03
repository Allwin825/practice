import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';
import { getOrCreateEncryptionKey } from '../auth/encryptionKey';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;

  // Ensure the 256-bit key exists in Keystore/Keychain on first run.
  // Pass this key to the encrypted open call once SQLCipher is available.
  await getOrCreateEncryptionKey();

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
