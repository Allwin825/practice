# BudgetVault Build Plan

See full plan in the original prompt. This file tracks phase status.

## Phase Status

- [x] **Phase 0 — Scaffold**: Expo app + TypeScript + Expo Router tabs + expo-sqlite schema + migrations + seed categories/rules
- [x] **Phase 1 — Import MVP**: File picker + CSV/XLSX mapper + dedup engine + review table + transactional commit + transactions list
- [x] **Phase 2 — Budget & Dashboard**: Budget tab + dashboard charts + weekly reminder
- [x] **Phase 3 — Banks & Polish**: PDF parsers + backup/export/restore + biometric lock + dark mode
- [x] **Phase 4 — Hardening**: Edge-case tests + 20k row performance + EAS APK build

## Phase 5 — Stabilize & Secure (Road to A+)

- [x] **5.1 First-run crash (C-1)**: `migrations.ts` now bootstraps `settings` table before reading `schema_version`; `db/index.ts` closes and nulls the handle on migration failure
- [ ] **5.2 Encrypt data at rest (H-1)**: Requires SQLCipher / expo-secure-store integration — native toolchain work, deferred
- [x] **5.3 Lock on cold start (H-2)**: `useBiometricLock` initializes to `'locked'` when enabled; triggers auth prompt immediately on mount
- [x] **5.4 Disable Android backup (H-3)**: `app.json` sets `android.allowBackup: false`
- [x] **5.5 Harden restore (M-3)**: `restore.ts` whitelists known columns per table; unknown keys are silently dropped instead of being interpolated into SQL
- [x] **5.6 Secure & clean backups (M-1, M-2)**: `export.ts` deletes cache file in `finally`; CSV cells prefixed with formula-trigger chars are guarded with `'`

## Phase 6 — Data Integrity & Correctness (Road to A+)

- [ ] **6.1 Money as integers (I-2)**: Schema v2 migration to store amounts as integer paise — deferred (requires full schema bump + data migration)
- [x] **6.2 No silent row loss (I-1)**: `commit.ts` only catches `UNIQUE constraint failed`; any other error propagates and rolls back the transaction; runtime dupes tracked separately in `rows_skipped_dupe`
- [x] **6.3 Safe parsing (I-3, I-4)**: `parseIndianAmount` throws on non-empty unparseable input instead of returning silent `0`; `detectParser` returns `null` when all scores are 0; `import.tsx` surfaces "unrecognised format" error

## Phase 7 — Test & Quality Infrastructure (Road to A+)

- [x] **7.1 Integration tests**: `tests/db.integration.test.ts` covers migration bootstrap ordering (fix 5.1) and commit error-propagation behaviour (fix 6.2)
- [ ] **7.2 Component/UI tests**: `@testing-library/react-native` — not yet
- [ ] **7.3 E2E**: Maestro/Detox smoke flow — not yet
- [ ] **7.4 Real performance test (T-1)**: Actual device benchmark with sequential inserts — not yet
- [x] **7.5 Fix Jest config (T-2)**: Replaced invalid `testPathPattern` with `testMatch` in `package.json`
- [x] **7.6 Coverage gate**: Added `coverageThreshold` (≥ 80% lines on `src/`) and `collectCoverageFrom` to Jest config
