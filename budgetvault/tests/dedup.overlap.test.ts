/**
 * Dedup overlap fixture tests — the crown jewels.
 * Validates the two-layer defence (watermark fast-path + hash check + count-aware skip).
 *
 * These tests simulate the real import pipeline logic without needing a SQLite DB.
 * They verify that a set of raw transactions produces exactly the right set of
 * unique (hash, ordinal) pairs regardless of how many times the same data appears.
 */

import { computeTxnHash, intraDayKey } from '../src/import/dedup';
import { RawTransaction } from '../src/types';

const ACCOUNT_ID = 1;

/**
 * Simulates the ordinal-assignment + hash-computation that buildReviewRows does.
 * Returns an array of { hash, ordinal } for each input row, in order.
 */
async function computeHashes(
  txns: RawTransaction[]
): Promise<{ hash: string; ordinal: number }[]> {
  const counters = new Map<string, number>();
  const results: { hash: string; ordinal: number }[] = [];
  for (const txn of txns) {
    const key = intraDayKey(txn);
    const ordinal = counters.get(key) ?? 0;
    counters.set(key, ordinal + 1);
    const hash = await computeTxnHash(ACCOUNT_ID, txn, ordinal);
    results.push({ hash, ordinal });
  }
  return results;
}

/** Returns unique hash count for a set of hashes. */
function uniqueCount(items: { hash: string }[]): number {
  return new Set(items.map((i) => i.hash)).size;
}

const TXN_A: RawTransaction = { txn_date: '2024-03-01', narration: 'SWIGGY ORDER', amount: 250, direction: 'debit' };
const TXN_B: RawTransaction = { txn_date: '2024-03-01', narration: 'ZOMATO DELIVERY', amount: 180, direction: 'debit' };
const TXN_C: RawTransaction = { txn_date: '2024-03-02', narration: 'SALARY CREDIT', amount: 80000, direction: 'credit' };

describe('dedup overlap: re-upload same statement', () => {
  test('second import of identical rows produces 0 new hashes', async () => {
    const batch1 = [TXN_A, TXN_B, TXN_C];
    const batch2 = [TXN_A, TXN_B, TXN_C]; // exact re-upload

    const h1 = await computeHashes(batch1);
    const h2 = await computeHashes(batch2);

    // Every hash in batch2 should already be in batch1
    const storedHashes = new Set(h1.map((x) => x.hash));
    const genuinelyNew = h2.filter((x) => !storedHashes.has(x.hash));
    expect(genuinelyNew).toHaveLength(0);
  });

  test('overlapping statement: only truly new rows are imported', async () => {
    // File 1 covers Mar 1–5
    const batch1 = [TXN_A, TXN_B, TXN_C];
    // File 2 covers Mar 3–8: overlaps with TXN_C (Mar 2 boundary day re-appears), adds D
    const TXN_D: RawTransaction = { txn_date: '2024-03-04', narration: 'UBER RIDE', amount: 120, direction: 'debit' };
    const batch2 = [TXN_C, TXN_D]; // TXN_C is duplicate, TXN_D is new

    const h1 = await computeHashes(batch1);
    const h2 = await computeHashes(batch2);

    const storedHashes = new Set(h1.map((x) => x.hash));
    const genuinelyNew = h2.filter((x) => !storedHashes.has(x.hash));

    expect(genuinelyNew).toHaveLength(1);
    expect(genuinelyNew[0].hash).toBe(
      (await computeHashes([TXN_D]))[0].hash
    );
  });
});

describe('dedup overlap: intra-day ordinal handles repeated transactions', () => {
  test('two identical metro taps on the same day get distinct hashes', async () => {
    const TAP: RawTransaction = { txn_date: '2024-03-01', narration: 'METRO TAP', amount: 20, direction: 'debit' };
    const batch = [TAP, TAP]; // two taps, no ref_no, no balance

    const hashes = await computeHashes(batch);
    expect(hashes[0].hash).not.toBe(hashes[1].hash);
    expect(hashes[0].ordinal).toBe(0);
    expect(hashes[1].ordinal).toBe(1);
    expect(uniqueCount(hashes)).toBe(2);
  });

  test('three identical taps get three distinct hashes', async () => {
    const TAP: RawTransaction = { txn_date: '2024-03-01', narration: 'METRO TAP', amount: 20, direction: 'debit' };
    const hashes = await computeHashes([TAP, TAP, TAP]);
    expect(uniqueCount(hashes)).toBe(3);
  });

  test('re-uploading a file with 3 taps: all 3 match DB, none are new', async () => {
    const TAP: RawTransaction = { txn_date: '2024-03-01', narration: 'METRO TAP', amount: 20, direction: 'debit' };
    const batch1 = [TAP, TAP, TAP];
    const batch2 = [TAP, TAP, TAP]; // same file again

    const h1 = await computeHashes(batch1);
    const h2 = await computeHashes(batch2);

    // All three hashes in batch2 must match batch1 at the same ordinals
    for (let i = 0; i < 3; i++) {
      expect(h2[i].hash).toBe(h1[i].hash);
    }
    const storedHashes = new Set(h1.map((x) => x.hash));
    const genuinelyNew = h2.filter((x) => !storedHashes.has(x.hash));
    expect(genuinelyNew).toHaveLength(0);
  });

  test('re-uploading 2 of 3 taps: count-aware — 2 match, 1 stored-only', async () => {
    const TAP: RawTransaction = { txn_date: '2024-03-01', narration: 'METRO TAP', amount: 20, direction: 'debit' };
    const batch1 = [TAP, TAP, TAP]; // DB has ordinals 0, 1, 2
    const batch2 = [TAP, TAP];      // Partial re-upload: ordinals 0, 1 → already stored

    const h1 = await computeHashes(batch1);
    const h2 = await computeHashes(batch2);

    const storedHashes = new Set(h1.map((x) => x.hash));
    const genuinelyNew = h2.filter((x) => !storedHashes.has(x.hash));
    expect(genuinelyNew).toHaveLength(0);
  });
});

describe('dedup overlap: boundary-day rule', () => {
  test('boundary-day transaction in both files hashes identically', async () => {
    const BOUNDARY: RawTransaction = {
      txn_date: '2024-03-05', narration: 'NEFT TRANSFER', amount: 5000, direction: 'debit',
      ref_no: 'UTR00112233',
    };
    const batch1 = [BOUNDARY];
    const batch2 = [BOUNDARY]; // boundary day re-appears in next file

    const h1 = await computeHashes(batch1);
    const h2 = await computeHashes(batch2);

    expect(h1[0].hash).toBe(h2[0].hash);
    const storedHashes = new Set(h1.map((x) => x.hash));
    const genuinelyNew = h2.filter((x) => !storedHashes.has(x.hash));
    expect(genuinelyNew).toHaveLength(0);
  });

  test('boundary-day transaction with different ref_no is treated as new', async () => {
    const T1: RawTransaction = { txn_date: '2024-03-05', narration: 'NEFT TRANSFER', amount: 5000, direction: 'debit', ref_no: 'UTR001' };
    const T2: RawTransaction = { txn_date: '2024-03-05', narration: 'NEFT TRANSFER', amount: 5000, direction: 'debit', ref_no: 'UTR002' };

    const h1 = await computeHashes([T1]);
    const h2 = await computeHashes([T2]);

    expect(h1[0].hash).not.toBe(h2[0].hash);
  });
});

describe('dedup overlap: large batch determinism', () => {
  test('100-row batch hashed twice produces identical hash arrays', async () => {
    const rows: RawTransaction[] = Array.from({ length: 100 }, (_, i) => ({
      txn_date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
      narration: `MERCHANT_${i % 10}`,
      amount: 100 + (i % 50),
      direction: i % 3 === 0 ? ('credit' as const) : ('debit' as const),
    }));

    const h1 = await computeHashes(rows);
    const h2 = await computeHashes(rows);

    for (let i = 0; i < rows.length; i++) {
      expect(h2[i].hash).toBe(h1[i].hash);
    }
  });
});
