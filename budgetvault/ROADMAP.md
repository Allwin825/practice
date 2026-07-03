# BudgetVault — Iteration 2 Roadmap ("Road to A+")

> Status: planning doc for the next build cycle. Derived from a full
> production-readiness audit of v1.0.0. Every audit finding referenced here
> (e.g. `C-1`, `H-1`, `I-2`) maps to a concrete work item below.

## Definition of done (what "complete + production-grade" means)

1. Installs and runs cleanly on a **fresh device**, every time.
2. The "privacy-first" claim is **true at rest**, not just on the network.
3. Every critical path (migrate → import → dedup → categorize → budget →
   backup/restore) has an **integration test**, not just unit tests.
4. Real-device performance is **measured**, not mocked.
5. Ships through a repeatable **CI/CD pipeline** with signed builds.

---

## Phase 5 — Stabilize & Secure (P0 — blocks everything)

| #   | Item                          | Fix                                                                                                                                                                                 | Acceptance criteria                                                                 |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 5.1 | **First-run crash (C-1)**     | In `migrations.ts`, create `settings` (or run full `CREATE_TABLES_SQL`) **before** reading `schema_version`. In `db/index.ts`, only assign `_db` after `runMigrations` succeeds; on failure, close + null the handle. | Integration test: open a brand-new DB file → app reaches seeded state with no throw. |
| 5.2 | **Encrypt data at rest (H-1)**| Move to a keyed DB (SQLCipher via `op-sqlite` / encrypted `expo-sqlite`, or a `expo-secure-store`-held key). Key held in device keystore, unlocked by biometrics.                     | DB file on disk is not greppable for narrations; opening without key fails.         |
| 5.3 | **Lock on cold start (H-2)**  | `lockState` initializes to `locked` when biometrics enabled; require auth before first render. Add configurable grace window.                                                       | Kill + relaunch → lock screen appears before any data.                             |
| 5.4 | **Disable Android backup (H-3)** | `android.allowBackup: false` + `dataExtractionRules` in `app.json`.                                                                                                              | `adb backup` yields no app data.                                                    |
| 5.5 | **Harden restore (M-3)**      | Whitelist **columns per table** (not just table names); reject unknown columns; gate the destructive wipe behind explicit confirm + auto pre-restore snapshot.                       | Malicious/malformed backup rejected with a clear error; no SQL-injection surface.   |
| 5.6 | **Secure & clean backups (M-1, M-2)** | Optional passphrase-encrypted export; delete cache file in a `finally` after share; CSV formula-injection guard (prefix `= + - @` with `'`).                                | Cache dir empty post-share; exported CSV opens inert in Excel/Sheets.               |

**Milestone M5:** "Runs on a fresh phone, and losing the phone doesn't leak finances."

---

## Phase 6 — Data Integrity & Correctness (P1)

| #   | Item                          | Fix                                                                                                                                                                       |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 6.1 | **Money as integers (I-2)**   | Store amounts as integer paise (`INTEGER`), format at the edges. Migration `v1→v2` converts existing `REAL` rows. Removes all float drift from sums/budgets.             |
| 6.2 | **No silent row loss (I-1)**  | In `commit.ts`, catch **only** the UNIQUE violation; surface any other error and roll back. Compute `rows_skipped_dupe` from actual loop results, not a pre-count.        |
| 6.3 | **Safe parsing (I-3, I-4)**   | Detect DD/MM vs MM/DD ambiguity and prompt when unsure; `parseIndianAmount`/`parseDate` return typed errors instead of `0`/silent misparse. `detectParser` returns `null` when all scores are 0 → "unrecognized format" UX. |
| 6.4 | **Import preview correctness**| Show per-row parse warnings in the review table (unparseable amount/date, low detector confidence).                                                                      |
| 6.5 | **Schema versioning discipline** | Real forward migrations (`v2`, `v3`) with idempotent, tested up-paths; snapshot the DB before each migration.                                                        |

**Milestone M6:** "Every rupee reconciles; nothing is silently dropped or misread."

---

## Phase 7 — Test & Quality Infrastructure (P1 — biggest grade lever)

v1.0.0 has 77 green unit tests but **0** DB/integration/UI tests — which is
exactly why C-1 shipped.

- **7.1 Integration layer:** run migrations + commit + queries against real
  `better-sqlite3` / `node:sqlite` in Jest. Cover: fresh migrate, dedup on
  re-import, transactional rollback on mid-import failure, backup→restore
  round-trip.
- **7.2 Component/UI tests:** `@testing-library/react-native` for lock screen,
  import review, budget editor.
- **7.3 E2E:** Maestro or Detox smoke flow — launch → import sample CSV →
  dashboard → set budget → export.
- **7.4 Real performance test (T-1):** benchmark the **actual** commit path
  (sequential await + native insert) with 20k rows on device/emulator; assert
  wall-clock + memory. Retire the mocked-crypto "perf" test or relabel it as a
  correctness test.
- **7.5 Fix Jest config (T-2):** replace invalid `testPathPattern` with
  `roots` / `testMatch`.
- **7.6 Coverage gate + lint:** ESLint + Prettier + `eslint-plugin-react-native`,
  `jest --coverage` threshold (≥80% on `src/`), `tsc --noEmit` — all in CI.
- **7.7 Fixture library:** redacted real-world statement samples per bank
  (HDFC/ICICI/SBI + edge cases: refunds, reversals, multi-currency, ₹0 rows).

**Milestone M7:** "A regression like C-1 can't merge."

---

## Phase 8 — UX, Responsiveness & Feature Completeness (P1/P2)

**Responsiveness / perf**

- 8.1 Move the import commit off the JS thread's blocking loop: batch inserts in
  chunks with an awaited yield; show a **progress bar**
  (`committing 4,200 / 20,000`). Prevents ANR-feel on large imports.
- 8.2 Tune the transaction `FlatList` (`getItemLayout`, `keyExtractor`);
  paginate/virtualize the import review for 20k rows.
- 8.3 Skeleton loaders + optimistic UI on categorize.

**Feature completeness**

- 8.4 **Search & filters** on transactions (text, amount range, category, date).
- 8.5 **Multi-account** first-class support (account switcher, per-account
  balances) — schema supports it; UI doesn't fully.
- 8.6 **Recurring/subscription detection** and cash-flow forecast (extends
  `projections.ts`).
- 8.7 **Category management UI** (create/rename/merge/reassign) + bulk
  re-categorize.
- 8.8 **Rules transparency:** let users see/edit learned rules (saved silently
  today).
- 8.9 **Onboarding**: first-run wizard (add account → import → set budget) —
  also naturally exercises the fixed migration path.

**Quality-of-life / platform**

- 8.10 **Accessibility:** `accessibilityLabel`s, dynamic font scaling, min
  contrast in both themes, screen-reader pass.
- 8.11 **i18n & locale:** currency/date not hardcoded to INR/DD-MM; wire the
  existing `currency` setting through all formatting.
- 8.12 **Empty/error states** for every screen; global error boundary (today
  errors go to `console.error`).

**Milestone M8:** "Feels finished, not just functional."

---

## Phase 9 — Release Engineering & Operations (P2)

- 9.1 **CI/CD:** GitHub Actions running lint → typecheck → unit → integration →
  privacy grep → EAS build on PR; block merge on red. (`eas.json` exists — wire
  it in.)
- 9.2 **Signed release builds** + versioning/changelog automation; internal test
  track (Play Console internal testing / TestFlight).
- 9.3 **Privacy-respecting observability — LOCAL-ONLY (decided):** No network
  crash reporting. Maintain a strictly on-device, append-only error log
  (rotating, size-capped) that the user can review in Settings and **export
  alongside a backup**. Preserves the zero-network invariant absolutely — no
  telemetry, no remote service, no opt-in network path.
- 9.4 **Store readiness:** privacy policy + data-safety form (easy — "no data
  leaves device"), screenshots, store listing.
- 9.5 **Docs:** keep `CLAUDE.md` / `PLAN.md` phase status current; add
  `ARCHITECTURE.md` and a threat model.

**Milestone M9:** "One green pipeline produces a signed, store-ready build."

---

## Prioritized backlog (start-here order)

| Priority | Items                              | Why                                              |
| -------- | ---------------------------------- | ------------------------------------------------ |
| **P0**   | 5.1 → 5.6                          | App can't reliably run / can't honor its promise |
| **P1**   | 7.1, 7.4, 6.1, 6.2, 8.1           | Prevent regressions + fix money/perf correctness |
| **P1**   | 6.3–6.5, 7.2–7.7                  | Robust parsing + real test pyramid               |
| **P2**   | 8.4–8.12, 9.1–9.5                 | Completeness, polish, ship pipeline              |

**Suggested sequencing:** Phase 5 (1 sprint) → Phase 7.1 + 7.4 + Phase 6 in
parallel (1 sprint) → Phase 8 (1–2 sprints) → Phase 9 (0.5 sprint).

---

## Audit finding index (for traceability)

| ID  | Severity | Summary                                                            | Addressed by |
| --- | -------- | ----------------------------------------------------------------- | ------------ |
| C-1 | Critical | Fresh-install crash: migrations read `settings` before it exists  | 5.1          |
| H-1 | High     | Data at rest unencrypted; biometric lock is a UI overlay only     | 5.2          |
| H-2 | High     | Cold-start auth bypass (`lockState` defaults to `unlocked`)       | 5.3          |
| H-3 | High     | `android.allowBackup` not disabled → adb can pull plaintext DB    | 5.4          |
| M-1 | Medium   | Plaintext backups linger in cache dir, never deleted              | 5.6          |
| M-2 | Medium   | CSV formula injection in export                                   | 5.6          |
| M-3 | Medium   | Restore interpolates untrusted column names into SQL              | 5.5          |
| I-1 | Med/Low  | `commit.ts` swallows all insert errors as "dupe" → silent loss    | 6.2          |
| I-2 | Med/Low  | Money stored as `REAL` float → drift in sums/budgets              | 6.1          |
| I-3 | Med/Low  | Date/amount silent misparse (DD/MM assumption, `0` on NaN)        | 6.3          |
| I-4 | Med/Low  | `detectParser` falls back to HDFC when nothing matches            | 6.3          |
| T-1 | Low      | "20k perf" test uses mocked crypto + `Promise.all` (unrealistic)  | 7.4          |
| T-2 | Low      | Invalid Jest `testPathPattern` config key (silently ignored)      | 7.5          |
