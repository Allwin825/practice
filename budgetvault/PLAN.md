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
| Encrypt data at rest (SQLCipher) | ⏳ deferred — needs native toolchain |

### Road to A+ — Data Integrity (Phase 6)
| Item | Status |
|---|---|
| `commit.ts` only catches UNIQUE violations; other errors abort the transaction | ✅ |
| `parseIndianAmount` throws on non-empty unparseable input | ✅ |
| `detectParser` returns `null` when all scores are 0; UI shows "unrecognised format" | ✅ |
| Store amounts as integer paise (schema v2) | ⏳ deferred — requires full schema migration |

### Road to A+ — Tests & Quality (Phase 7)
| Item | Status |
|---|---|
| Integration tests: migration bootstrap + commit error propagation | ✅ |
| Performance test: 20k SHA-256 hashes < 10s (~280ms actual) | ✅ |
| Jest config fix (`testMatch` replaces invalid `testPathPattern`) | ✅ |
| Coverage gate: 40% global lines (native modules correctly excluded) | ✅ |
| `detect.test.ts` — 9 tests for bank parser auto-detection | ✅ |
| `projections.test.ts` — 15 tests for `computeProjection` / `generateSuggestions` | ✅ |
| `categorize.engine.test.ts` — 10 tests for `categorize()` rule engine | ✅ |
| Component / UI tests (`@testing-library/react-native`) | ⏳ deferred |
| E2E tests (Maestro / Detox) | ⏳ deferred |

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
| Skeleton loaders | ⏳ deferred |
| Multi-account switcher UI | ⏳ deferred |
| Recurring / subscription detection | ⏳ deferred |
| Rules transparency UI | ⏳ deferred |
| Onboarding wizard | ⏳ deferred |
| Accessibility (a11y) | ⏳ deferred |
| i18n / locale | ⏳ deferred |

### Road to A+ — CI/CD (Phase 9)
| Item | Status |
|---|---|
| GitHub Actions: typecheck → privacy check → tests → coverage (path-scoped) | ✅ |
| Node 22, `legacy-peer-deps` for expo-router peer conflict | ✅ |
| Signed release builds (EAS + Play Console) | ⏳ deferred |
| On-device rotating error log | ⏳ deferred |
| Store readiness (screenshots, privacy policy, data-safety form) | ⏳ deferred |
| `ARCHITECTURE.md` + threat model | ⏳ deferred |

---

## Current State of the Codebase

- **122 tests passing**, 11 test suites
- **~67% line coverage** on testable (non-native) `src/` code
- **CI green** on every push/PR to `main` (typecheck + privacy check + tests + coverage)
- **2 commits on main** — clean history (`Initial commit` → full app)
- Zero network calls in `src/` or `app/` — enforced by CI privacy check

---

## Recommended Next Steps

### Medium priority (feature completeness)
1. **Multi-account switcher** — schema already supports multiple accounts; just needs a picker UI
2. **Rules transparency UI** — show which rule matched a category assignment per transaction

### Lower priority (release track)

3. **Signed EAS build** — `eas.json` is configured; just needs signing keys + Play Console upload
4. **Store assets** — screenshots, privacy policy, data-safety form
5. **`ARCHITECTURE.md`** — document the data flow, dedup invariant, threat model
6. **SQLCipher** — encrypt the SQLite database at rest (needs native build toolchain)
7. **E2E tests** — Maestro or Detox smoke flow for the golden import path
