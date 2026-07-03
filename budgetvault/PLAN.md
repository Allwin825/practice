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
- [ ] **7.2 Component/UI tests**: `@testing-library/react-native` — deferred
- [ ] **7.3 E2E**: Maestro/Detox smoke flow — deferred
- [x] **7.4 Real performance test (T-1)**: `tests/performance.test.ts` — 20k sequential SHA-256 hashes via real Node.js crypto; asserts < 10s (actual: ~310ms); also tests uniqueness and determinism
- [x] **7.5 Fix Jest config (T-2)**: Replaced invalid `testPathPattern` with `testMatch` in `package.json`
- [x] **7.6 Coverage gate**: Added `coverageThreshold` (≥ 80% lines on `src/`) and `collectCoverageFrom` to Jest config

## Phase 8 — UX, Responsiveness & Feature Completeness (Road to A+)

- [x] **8.1 Import progress bar**: `commitReviewRows` accepts `onProgress(done, total)` callback; import screen shows animated progress bar with count during large commits
- [ ] **8.2 FlatList tuning**: `getItemLayout`, `keyExtractor`, pagination for 20k row review — deferred
- [ ] **8.3 Skeleton loaders**: deferred
- [x] **8.4 Category filter picker**: transactions screen "Category" chip now opens a full category picker modal (was previously a no-op clear-only chip); distinct empty states for "no transactions" vs "no filter results"
- [ ] **8.5 Multi-account UI**: schema supports it; switcher UI deferred
- [ ] **8.6 Recurring/subscription detection**: deferred
- [ ] **8.7 Category management UI**: deferred
- [ ] **8.8 Rules transparency UI**: deferred
- [ ] **8.9 Onboarding wizard**: dashboard already guides to import; full wizard deferred
- [ ] **8.10 Accessibility**: deferred
- [ ] **8.11 i18n/locale**: deferred
- [x] **8.12 Empty/error states**: global `ErrorBoundary` wraps root layout; transactions screen has distinct "no data" vs "no filter results" states with icons and copy

## Phase 9 — Release Engineering & Operations (Road to A+)

- [x] **9.1 CI/CD**: `.github/workflows/ci.yml` — runs typecheck → privacy check → unit/integration tests → coverage on every push/PR to main; path-scoped so non-budgetvault changes are skipped
- [ ] **9.2 Signed release builds**: EAS config exists (`eas.json`); signing + Play Console upload — deferred
- [ ] **9.3 Local-only observability**: on-device rotating error log — deferred
- [ ] **9.4 Store readiness**: screenshots, privacy policy, data-safety form — deferred
- [ ] **9.5 Docs**: `ARCHITECTURE.md` + threat model — deferred
