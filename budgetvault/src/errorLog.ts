import { getDb } from './db';

export interface ErrorEntry {
  message: string;
  stack?: string;
  timestamp: string;
}

const MAX_ENTRIES = 20;
const SETTINGS_KEY = 'error_log';

export async function logError(message: string, stack?: string): Promise<void> {
  try {
    const db = await getDb();
    const raw = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [SETTINGS_KEY]
    );
    const entries: ErrorEntry[] = raw?.value ? JSON.parse(raw.value) : [];
    entries.unshift({ message, stack, timestamp: new Date().toISOString() });
    const trimmed = entries.slice(0, MAX_ENTRIES);
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [SETTINGS_KEY, JSON.stringify(trimmed)]
    );
  } catch {
    // Never throw from error logging
  }
}

export async function getErrorLog(): Promise<ErrorEntry[]> {
  try {
    const db = await getDb();
    const raw = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [SETTINGS_KEY]
    );
    return raw?.value ? JSON.parse(raw.value) : [];
  } catch {
    return [];
  }
}

export async function clearErrorLog(): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM settings WHERE key = ?', [SETTINGS_KEY]);
  } catch {
    // ignore
  }
}
