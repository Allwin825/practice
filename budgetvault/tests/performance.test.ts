// 7.4 — Real performance benchmark: sequential SHA-256 hashing via Node.js crypto
// (tests/setup.ts swaps expo-crypto for the real Node.js implementation, exactly
// matching the hashing path used in production on-device)

import { computeTxnHash } from '../src/import/dedup';
import type { ReviewRow } from '../src/types';

const ROW_COUNT = 20_000;
const WALL_CLOCK_LIMIT_MS = 10_000;

function makeRow(i: number): ReviewRow {
  return {
    txn_date: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
    narration: `Payment to MERCHANT_${i % 100} ref ${i}`,
    amount: 100 + (i % 9900),
    direction: i % 3 === 0 ? 'credit' : 'debit',
    ref_no: `REF${String(i).padStart(8, '0')}`,
    balance_after: 100_000 - i,
    is_dupe: false,
    skip: false,
    intra_day_ordinal: i % 10,
    suggested_category_id: null,
    category_source: 'uncategorized',
    txn_hash: '',
  };
}

describe(`dedup performance — sequential SHA-256 (7.4, ${ROW_COUNT} rows)`, () => {
  it(`computes ${ROW_COUNT} hashes sequentially in < ${WALL_CLOCK_LIMIT_MS}ms`, async () => {
    const start = performance.now();

    for (let i = 0; i < ROW_COUNT; i++) {
      await computeTxnHash(1, makeRow(i), i % 10);
    }

    const elapsed = performance.now() - start;
    const perRow = elapsed / ROW_COUNT;
    console.log(
      `[perf] ${ROW_COUNT} hashes: ${elapsed.toFixed(0)}ms total, ${perRow.toFixed(3)}ms/row`
    );
    expect(elapsed).toBeLessThan(WALL_CLOCK_LIMIT_MS);
  }, WALL_CLOCK_LIMIT_MS + 5_000);

  it('produces unique hashes for every distinct transaction in a 1 000-row batch', async () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 1_000; i++) {
      hashes.add(await computeTxnHash(1, makeRow(i), i % 10));
    }
    expect(hashes.size).toBe(1_000);
  });

  it('same inputs always yield the same hash (determinism)', async () => {
    const row = makeRow(42);
    const h1 = await computeTxnHash(1, row, 3);
    const h2 = await computeTxnHash(1, row, 3);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64); // hex SHA-256
  });

  it('different account IDs produce different hashes (account isolation)', async () => {
    const row = makeRow(7);
    const h1 = await computeTxnHash(1, row, 0);
    const h2 = await computeTxnHash(2, row, 0);
    expect(h1).not.toBe(h2);
  });
});
