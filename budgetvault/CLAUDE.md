# BudgetVault — Claude Code Conventions

## Project
Privacy-first local budget tracker. Expo React Native + TypeScript + expo-sqlite.
**Zero network calls for user data. All processing on-device.**

## Key invariants (never break)
1. No `fetch(` or `axios` calls in `src/` or `app/` (grep CI check).
2. Import pipeline must be fully transactional — a failed parse commits nothing.
3. Dedup is deterministic: `UNIQUE(account_id, txn_hash)` is the DB-level guarantee.
4. `txn_hash = SHA-256(account_id | txn_date | amount | direction | normalized_narration | ref_no | balance_after | intra_day_ordinal)`

## Structure
- `app/` — Expo Router screens (tabs)
- `src/db/` — schema, migrations, all SQL queries
- `src/import/` — file parsers, dedup, commit pipeline
- `src/categorize/` — rules engine (seed + learned)
- `src/types/` — shared TypeScript interfaces
- `tests/` — unit tests (dedup fixtures are the crown jewels)

## Adding a bank parser
1. Create `src/import/parsers/<bank>.ts` implementing `StatementParser`
2. Register in `src/import/detect.ts`
3. Add unit test with redacted sample rows

## DB changes
- Bump `SCHEMA_VERSION` in `src/db/schema.ts`
- Add migration logic in `src/db/migrations.ts` (idempotent)

## Current phase: Complete (v1.0.0)
All 4 phases shipped. See PLAN.md for full feature list.
