# BudgetVault — Architecture & Threat Model

## Overview

BudgetVault is a privacy-first, fully offline personal finance tracker built with Expo + React Native + TypeScript. Every byte of financial data stays on the device. There are zero network calls for user data — enforced by a CI grep check on every push.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | Expo Router (file-based tabs), React Native |
| Language | TypeScript (strict) |
| Database | expo-sqlite (SQLite on-device) |
| File parsing | Custom parsers (CSV) + SheetJS (XLSX) + PDF.js |
| Biometric auth | expo-local-authentication |
| Notifications | expo-notifications (local only) |
| Backup/restore | expo-file-system (local sharing) |
| Crypto | expo-crypto (SHA-256 for dedup) |

---

## Directory Structure

```
app/
  _layout.tsx          Root layout: ThemeProvider + ErrorBoundary + BiometricLock
  (tabs)/
    index.tsx          Dashboard — donut chart, trend, budget snapshot
    import.tsx         Import wizard: pick → parse → review → commit
    transactions.tsx   Transaction list with search, filters, category editor
    budget.tsx         Budget planner + projections + recurring detection
    settings.tsx       Accounts, categories, reminders, backup, error log
  components/
    DonutChart.tsx     SVG-based donut chart
    TrendChart.tsx     6-month bar/line trend chart
    ErrorBoundary.tsx  Global React error boundary (logs to SQLite)

src/
  db/
    index.ts           Singleton DB handle + getDb()
    schema.ts          CREATE TABLE statements + SCHEMA_VERSION
    migrations.ts      Idempotent migration runner (runs on every open)
    queries.ts         All SQL query functions (no raw SQL in screens)
  import/
    detect.ts          Parser auto-detection by extension + header fingerprint
    commit.ts          Transactional batch insert with UNIQUE-violation dedup
    parsers/
      hdfcCsvParser.ts
      iciciBankCsvParser.ts
      sbiCsvParser.ts
      genericCsvParser.ts
      xlsxParser.ts
      pdfParser.ts
  categorize/
    engine.ts          Rule matching, cache, learned-rule persistence
  budget/
    projections.ts     computeProjection(), generateSuggestions() — pure TS
  auth/
    biometric.ts       isBiometricAvailable()
    useBiometricLock.ts  Lock state machine: locked → authenticating → unlocked
  backup/
    export.ts          JSON + CSV export with formula-injection guard
    restore.ts         Column-whitelist restore (prevents SQL injection)
  notifications/       Local weekly reminder scheduling
  theme/               ThemeContext, color tokens, dark mode
  types/               Shared TypeScript interfaces
  errorLog.ts          On-device rotating error log (SQLite settings table)
```

---

## Database Schema

### `schema_version` (v1)
| Column | Type | Notes |
|---|---|---|
| version | INTEGER | Bumped on each schema change |

### `settings`
| Column | Type | Notes |
|---|---|---|
| key | TEXT PRIMARY KEY | e.g. `biometric_enabled`, `reminder_enabled`, `error_log` |
| value | TEXT | String value (booleans as `'true'`/`'false'`) |

### `accounts`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | User-visible account name |
| bank | TEXT | Parser ID e.g. `hdfc_csv` |
| kind | TEXT | `bank` / `credit_card` / `wallet` |
| last_txn_date | TEXT | High-water mark for statement date range |

### `categories`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT UNIQUE | |
| kind | TEXT | `expense` / `income` / `transfer` |
| icon | TEXT | Optional emoji / icon name |
| color | TEXT | Hex color for UI |
| is_system | INTEGER | `1` = seed category (undeletable) |

### `category_rules`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| pattern | TEXT | Substring to match (case-insensitive) |
| category_id | INTEGER FK | Target category |
| priority | INTEGER | Higher = matched first |
| source | TEXT | `seed` / `user` / `learned` |

### `transactions`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| account_id | INTEGER FK | |
| batch_id | INTEGER FK | |
| txn_date | TEXT | ISO date `YYYY-MM-DD` |
| narration | TEXT | Raw bank narration |
| ref_no | TEXT | Cheque / UPI ref |
| amount | REAL | Absolute value in INR |
| direction | TEXT | `debit` / `credit` |
| balance_after | REAL | Running balance from statement |
| category_id | INTEGER FK | Nullable = uncategorized |
| category_source | TEXT | `rule` / `learned` / `manual` / `uncategorized` |
| txn_hash | TEXT UNIQUE | SHA-256 dedup hash (see below) |
| notes | TEXT | User notes (future) |

### `import_batches`
Records each import for the history view and rollback audit trail.

### `budgets`
Monthly planned amounts per category. A `null` category_id means the overall income target.

---

## Dedup Invariant

Every transaction row has a deterministic `txn_hash`:

```
txn_hash = SHA-256(
  account_id || '|' ||
  txn_date   || '|' ||
  amount     || '|' ||
  direction  || '|' ||
  normalized_narration || '|' ||
  ref_no     || '|' ||
  balance_after || '|' ||
  intra_day_ordinal
)
```

`normalized_narration` = whitespace-collapsed, uppercased narration.  
`intra_day_ordinal` = row position within the same date in the statement (handles same-day duplicates with identical amounts).

The DB enforces `UNIQUE(account_id, txn_hash)`. On import, `INSERT OR IGNORE` is used; rows that violate the constraint are counted as `rows_skipped_dupe`. This means re-importing the same statement is always safe.

---

## Import Pipeline

```
pickFile()
  └── detectParser(fileMeta, firstBytes)    ← scores each registered parser
        └── parser.parse(content, meta)     ← returns RawTransaction[]
              └── buildReviewRows(db, accountId, rawTxns)
                    ├── compute txn_hash for each row
                    ├── check existing hashes (batch IN query)
                    ├── run categorize() against loaded rules
                    └── return ReviewRow[] (with is_dupe flags)
                          └── user reviews, edits categories
                                └── commitReviewRows(db, accountId, rows, ...)
                                      ├── BEGIN TRANSACTION
                                      ├── INSERT OR IGNORE INTO transactions (batch)
                                      ├── INSERT INTO import_batches
                                      ├── COMMIT  (or ROLLBACK on any non-UNIQUE error)
                                      └── saveLearntRule() for manual category changes
```

The import is **fully transactional**: if any non-dedup error occurs during commit, the entire batch is rolled back and nothing is written to the DB.

---

## Categorization Engine

Rules are loaded from `category_rules`, sorted by `priority DESC`. On each call to `categorize(narration, rules)`:
1. Iterate rules in order
2. For each rule: check `narration.toUpperCase().includes(pattern.toUpperCase())`
3. First match wins
4. Source is `'rule'` for seed/user rules, `'learned'` for ML-trained rules

Rules are cached in module scope. Call `invalidateRulesCache()` after DB writes.

---

## Threat Model

### What we protect
- Transaction data (amounts, narrations, balances)
- Account metadata (bank names, balances)
- Category/budget plans

### Attack surfaces

| Vector | Mitigation |
|---|---|
| Network exfiltration | Zero network calls in `src/` and `app/`; CI grep blocks `fetch(` and `axios` |
| Cloud backup exposure | `android.allowBackup: false` in AndroidManifest |
| Physical device access | Biometric lock enforced at cold-start; lock triggers after 10s backgrounding |
| Malicious bank statement (CSV injection) | CSV export guards formula-injection characters (`=`, `+`, `-`, `@`) with leading `'` |
| Malicious restore file | Restore uses a column whitelist; unknown keys are silently dropped, never interpolated into SQL |
| SQL injection via restore | Parameterized queries throughout; whitelist prevents column name injection |
| Dedup bypass | DB-level `UNIQUE` constraint is the ground truth; application-level check is advisory only |
| Re-import data loss | `INSERT OR IGNORE` — existing rows are never overwritten |

### What we explicitly defer
- **SQLCipher** (encrypt the DB file at rest) — needs native build toolchain
- **Certificate pinning** — not applicable (no network calls)
- **Root/jailbreak detection** — out of scope for v1

---

## Data Flow Diagram

```
Bank Statement (CSV/XLSX/PDF)
        │
        ▼
  detectParser()  ──── scorer: extension + header fingerprint
        │
        ▼
  parser.parse()  ──── returns raw rows [{date, narration, amount, direction, balance}]
        │
        ▼
 buildReviewRows() ─── SHA-256 hash per row
        │              check DB for existing hashes (dupes flagged)
        │              categorize() each row via rules engine
        ▼
  User Review UI ────  edit categories, skip rows
        │
        ▼
 commitReviewRows() ── BEGIN TRANSACTION
        │              INSERT OR IGNORE transactions (batch insert, 500-row chunks)
        │              INSERT import_batch record
        │              COMMIT / ROLLBACK
        │
        ▼
   SQLite (local) ─── single source of truth, never leaves device
        │
        ▼
 Budget / Dashboard ── aggregate queries, pure in-memory projections
```

---

## Key Invariants (Never Break)

1. **No network calls** for user data — enforced by CI (`grep -r "fetch\|axios" src/ app/`)
2. **Import is fully transactional** — partial writes never occur
3. **Dedup is DB-level** — `UNIQUE(account_id, txn_hash)` is the single source of truth
4. **System categories are undeletable** — `is_system = 1` checked in `deleteCategory`
5. **Restore uses a whitelist** — unknown column names are dropped before any SQL is executed
