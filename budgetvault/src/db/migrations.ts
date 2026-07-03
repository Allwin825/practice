import { SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, SCHEMA_VERSION } from './schema';
import { SEED_CATEGORIES, SEED_RULES } from '../categorize/seedData';

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Bootstrap the settings table before reading schema_version — without this,
  // a fresh-install SELECT crashes because the table doesn't exist yet (fix C-1).
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`
  );

  const result = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'schema_version'"
  );
  const currentVersion = result ? parseInt(result.value, 10) : 0;

  if (currentVersion >= SCHEMA_VERSION) return;

  await db.withTransactionAsync(async () => {
    if (currentVersion < 1) {
      await db.execAsync(CREATE_TABLES_SQL);
      await seedInitialData(db);
    }

    if (currentVersion < 2) {
      // v1→v2: convert REAL rupee amounts to INTEGER paise (multiply × 100).
      // Fresh-install tables are empty so these UPDATE statements are no-ops.
      await db.execAsync(
        'UPDATE transactions SET amount = CAST(ROUND(amount * 100) AS INTEGER)'
      );
      await db.execAsync(
        'UPDATE transactions SET balance_after = CAST(ROUND(balance_after * 100) AS INTEGER) WHERE balance_after IS NOT NULL'
      );
      await db.execAsync(
        'UPDATE budgets SET planned_amount = CAST(ROUND(planned_amount * 100) AS INTEGER)'
      );
    }

    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', ?)",
      [String(SCHEMA_VERSION)]
    );
  });
}

async function seedInitialData(db: SQLiteDatabase): Promise<void> {
  const existingCats = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );
  if (existingCats && existingCats.count > 0) return;

  for (const cat of SEED_CATEGORIES) {
    await db.runAsync(
      'INSERT OR IGNORE INTO categories (name, kind, icon, color, is_system) VALUES (?, ?, ?, ?, 1)',
      [cat.name, cat.kind, cat.icon ?? null, cat.color ?? null]
    );
  }

  for (const rule of SEED_RULES) {
    const cat = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM categories WHERE name = ?',
      [rule.categoryName]
    );
    if (cat) {
      await db.runAsync(
        'INSERT OR IGNORE INTO category_rules (pattern, category_id, priority, source) VALUES (?, ?, ?, ?)',
        [rule.pattern, cat.id, rule.priority ?? 100, 'seed']
      );
    }
  }

  await db.runAsync(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('reminder_enabled', 'true')"
  );
  await db.runAsync(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('reminder_day', '0')"
  );
  await db.runAsync(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('reminder_hour', '18')"
  );
  await db.runAsync(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('reminder_minute', '0')"
  );
  await db.runAsync(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('currency', 'INR')"
  );
}
