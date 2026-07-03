# BudgetVault — Status & Roadmap

## What's Done

### Core App — Shipped (Phases 0–4)
| Feature | Status |
|---|---|
| Expo + TypeScript + Expo Router tabs | ✅ |
| expo-sqlite schema, migrations, seed data | ✅ |
| File picker (CSV / XLSX) | ✅ |
| Bank parser auto-detect: HDFC, ICICI, SBI, generic CSV, XLSX | ✅ |
| SHA-256 dedup engine — `UNIQUE(account_id, txn_hash)` | ✅ |
| Import review table + transactional commit | ✅ |
| Transactions list with search & date filter | ✅ |
| Budget tab + dashboard charts (donut + monthly trend) | ✅ |
| Weekly reminder notifications | ✅ |
| PDF statement parsers | ✅ |
| Backup / export (JSON + CSV) / restore | ✅ |
| Biometric lock (cold-start enforced) | ✅ |
| Dark mode | ✅ |
| `android.allowBackup: false` | ✅ |

### Road to A+ — Security (Phase 5)
| Item | Status |
|---|---|
| Fresh-install crash fix — `settings` table bootstrapped before `schema_version` read | ✅ |
| Cold-start biometric — lock initialises to `locked` state immediately | ✅ |
| Restore column whitelist — unknown keys silently dropped, not interpolated into SQL | ✅ |
| Export: cache file deleted in `finally`; CSV formula-injection guard | ✅ |
| 5.2 Encryption key layer — 256-bit key in Android Keystore/iOS Keychain via expo-secure-store | ✅ key stored; DB still plaintext |
| 5.2 Encrypt DB at rest (SQLCipher) — pass key to DB open call | ⏳ blocked — needs native build toolchain (dev client / EAS) |

### Road to A+ — Data Integrity (Phase 6)
| Item | Status |
|---|---|
| `commit.ts` only catches UNIQUE violations; other errors abort the transaction | ✅ |
| `parseIndianAmount` throws on non-empty unparseable input | ✅ |
| `detectParser` returns `null` when all scores are 0; UI shows "unrecognised format" | ✅ |
| 6.1 Store amounts as integer paise (schema v2) — migration, commit ×100, display ÷100 | ✅ |

### Road to A+ — Tests & Quality (Phase 7)
| Item | Status |
|---|---|
| Integration tests: migration bootstrap + commit error propagation (mocked DB) | ✅ |
| 7.1b Real SQLite integration tests via better-sqlite3 — migrations, paise storage, dedup, rollback | ✅ 13 tests |
| Dedup hash-stability golden test — pins exact SHA-256 for fixture row in rupees | ✅ |
| Performance test: 20k SHA-256 hashes < 10s (~280ms actual) | ✅ |
| Jest config fix (`testMatch` replaces invalid `testPathPattern`) | ✅ |
| Coverage gate: 40% global lines (native modules correctly excluded) | ✅ |
| `detect.test.ts` — 9 tests for bank parser auto-detection | ✅ |
| `projections.test.ts` — 15 tests for `computeProjection` / `generateSuggestions` | ✅ |
| `categorize.engine.test.ts` — 10 tests for `categorize()` rule engine | ✅ |
| Component / UI tests (`@testing-library/react-native`) | ⏳ deferred |
| E2E tests (Maestro / Detox) | ⏳ blocked — needs device/emulator |

### Road to A+ — UX (Phase 8)
| Item | Status |
|---|---|
| Import progress bar with row count | ✅ |
| Category filter picker modal on transactions screen | ✅ |
| Distinct empty states: first-run vs filter-mismatch | ✅ |
| Global `ErrorBoundary` wraps root layout | ✅ |
| FlatList tuning — import review table (stable key, windowing) | ✅ |
| FlatList tuning — transactions screen (windowing) | ✅ |
| Category management UI (add / delete user categories in Settings) | ✅ |
| Skeleton loaders — transactions, budget, dashboard screens | ✅ |
| Multi-account switcher — account filter chip on transactions screen | ✅ |
| Recurring / subscription detection — budget screen "Detected Subscriptions" | ✅ |
| Rules transparency — category source badge in transaction edit modal | ✅ |
| Accessibility (a11y) — labels + roles on nav, chips, list rows, modals | ✅ |
| Onboarding wizard | ⏳ deferred — complex multi-screen flow |
| i18n / locale | ⏳ deferred — large scope |

### Road to A+ — CI/CD (Phase 9)
| Item | Status |
|---|---|
| GitHub Actions: typecheck → privacy check → tests → coverage (path-scoped) | ✅ |
| Node 22, `legacy-peer-deps` for expo-router peer conflict | ✅ |
| On-device rotating error log — SQLite settings table + Settings UI + ErrorBoundary | ✅ |
| `ARCHITECTURE.md` + threat model | ✅ |
| Signed release builds (EAS + Play Console) | ⏳ deferred — needs signing keys |
| Store readiness (screenshots, privacy policy, data-safety form) | ⏳ deferred — needs design assets |

---

## Current State of the Codebase

- **122 tests passing**, 11 test suites
- **67.33% line coverage** (statements 65.45%, branches 59.64%, functions 56.09%) on testable (non-native) `src/` code
- **CI green** on every push/PR to `main` (typecheck + privacy check + tests + coverage)
- **Branch `claude/phase-next-tests-and-ux`** — 2 commits ahead of main with Phase 7–8 work
- Zero network calls in `src/` or `app/` — enforced by CI privacy check

### Recently completed (this branch)
- 34 new unit tests across `detect`, `projections`, and `categorize/engine` modules
- Category management UI in Settings (add / delete user categories)
- FlatList windowing on import review table and transactions screen
- Multi-account switcher chip on transactions screen (filters by account)
- Rules transparency: category source badge in transaction edit modal
- Skeleton loaders on transactions, budget, and dashboard screens
- Recurring/subscription detection in budget screen
- Accessibility labels and roles on all major interactive elements
- On-device rotating error log (SQLite, up to 20 entries, shown in Settings)
- `ARCHITECTURE.md` — full data flow, schema, dedup invariant, threat model

---

## Recommended Next Steps

### Remaining (release track)
1. **Signed EAS build** — `eas.json` is configured; just needs signing keys + Play Console upload
2. **Store assets** — screenshots, privacy policy, data-safety form
3. **SQLCipher** — encrypt the SQLite database at rest (needs native build toolchain)
4. **E2E tests** — Maestro or Detox smoke flow for the golden import path
5. **Onboarding wizard** — multi-screen flow for first-run users
6. **i18n / locale** — multi-language support
