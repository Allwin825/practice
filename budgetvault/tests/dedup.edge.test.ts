import { computeTxnHash, intraDayKey } from '../src/import/dedup';
import type { RawTransaction } from '../src/types';

// Mock expo-crypto for jest environment
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_alg: string, payload: string): Promise<string> => {
    // Use a deterministic pseudo-hash for testing (Node.js crypto)
    const { createHash } = require('crypto');
    return createHash('sha256').update(payload).digest('hex');
  },
}));

function makeTxn(overrides: Partial<RawTransaction> = {}): RawTransaction {
  return {
    txn_date: '2025-06-15',
    narration: 'UPI PAYMENT',
    amount: 500,
    direction: 'debit',
    ...overrides,
  };
}

// ── Boundary-day tests ────────────────────────────────────────────────────────

describe('Boundary-day dedup rule', () => {
  test('same transaction on watermark boundary is detected as dupe', async () => {
    const txn = makeTxn({ txn_date: '2025-06-30' });
    const hash1 = await computeTxnHash(1, txn, 0);
    const hash2 = await computeTxnHash(1, txn, 0);
    expect(hash1).toBe(hash2);
  });

  test('same transaction on first day of month is stable', async () => {
    const txn = makeTxn({ txn_date: '2025-07-01' });
    const hash1 = await computeTxnHash(1, txn, 0);
    const hash2 = await computeTxnHash(1, txn, 0);
    expect(hash1).toBe(hash2);
  });
});

// ── Reversed-sign handling ────────────────────────────────────────────────────

describe('Direction matters for hash uniqueness', () => {
  test('same narration/amount with different direction produces different hash', async () => {
    const debit = makeTxn({ direction: 'debit' });
    const credit = makeTxn({ direction: 'credit' });
    const h1 = await computeTxnHash(1, debit, 0);
    const h2 = await computeTxnHash(1, credit, 0);
    expect(h1).not.toBe(h2);
  });

  test('refund (same narration, reversed direction) is NOT a duplicate', async () => {
    const purchase = makeTxn({ narration: 'AMAZON PURCHASE', direction: 'debit', amount: 999 });
    const refund = makeTxn({ narration: 'AMAZON PURCHASE', direction: 'credit', amount: 999 });
    const h1 = await computeTxnHash(1, purchase, 0);
    const h2 = await computeTxnHash(1, refund, 0);
    expect(h1).not.toBe(h2);
  });
});

// ── Account isolation ─────────────────────────────────────────────────────────

describe('Account isolation', () => {
  test('identical transaction in different accounts produces different hash', async () => {
    const txn = makeTxn();
    const h1 = await computeTxnHash(1, txn, 0);
    const h2 = await computeTxnHash(2, txn, 0);
    expect(h1).not.toBe(h2);
  });
});

// ── Intra-day ordinal ─────────────────────────────────────────────────────────

describe('Intra-day ordinal', () => {
  test('two identical metro taps get different hashes via ordinal', async () => {
    const tap = makeTxn({ narration: 'DMRC METRO TAP', amount: 30 });
    const h0 = await computeTxnHash(1, tap, 0);
    const h1 = await computeTxnHash(1, tap, 1);
    expect(h0).not.toBe(h1);
  });

  test('three identical taps all unique', async () => {
    const tap = makeTxn({ narration: 'DMRC METRO TAP', amount: 30 });
    const hashes = await Promise.all([0, 1, 2].map((ord) => computeTxnHash(1, tap, ord)));
    const unique = new Set(hashes);
    expect(unique.size).toBe(3);
  });

  test('intraDayKey groups taps of same amount on same day', () => {
    const tap1 = makeTxn({ narration: 'METRO TAP', amount: 30 });
    const tap2 = makeTxn({ narration: 'METRO  TAP', amount: 30 }); // extra space normalised
    const k1 = intraDayKey(tap1);
    const k2 = intraDayKey(tap2);
    expect(k1).toBe(k2);
  });
});

// ── Narration normalisation ───────────────────────────────────────────────────

describe('Narration normalisation', () => {
  test('extra whitespace is normalised before hashing', async () => {
    const txn1 = makeTxn({ narration: 'UPI  PAYMENT' });
    const txn2 = makeTxn({ narration: 'UPI PAYMENT' });
    const h1 = await computeTxnHash(1, txn1, 0);
    const h2 = await computeTxnHash(1, txn2, 0);
    expect(h1).toBe(h2);
  });

  test('ref_no undefined and ref_no empty string hash the same', async () => {
    const txn1 = makeTxn({ ref_no: undefined });
    const txn2 = makeTxn({ ref_no: '' });
    const h1 = await computeTxnHash(1, txn1, 0);
    const h2 = await computeTxnHash(1, txn2, 0);
    expect(h1).toBe(h2);
  });
});

// ── 20k-row performance test ──────────────────────────────────────────────────

describe('Performance: 20k rows', () => {
  test('computes 20000 hashes in under 10 seconds', async () => {
    const rows: RawTransaction[] = [];
    for (let i = 0; i < 20000; i++) {
      rows.push({
        txn_date: `2025-${String(Math.floor(i / 1000) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
        narration: `TRANSACTION ${i}`,
        amount: (i % 500) + 1,
        direction: i % 2 === 0 ? 'debit' : 'credit',
        ref_no: `REF${i}`,
      });
    }

    const start = Date.now();
    await Promise.all(rows.map((r, i) => computeTxnHash(1, r, i % 5)));
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(10000);
  }, 15000); // 15s timeout

  test('20000 unique transactions produce 20000 unique hashes', async () => {
    const rows: RawTransaction[] = Array.from({ length: 20000 }, (_, i) => ({
      txn_date: `2025-06-${String((i % 28) + 1).padStart(2, '0')}`,
      narration: `UNIQUE TRANSACTION ${i}`,
      amount: i + 1,
      direction: 'debit' as const,
    }));

    const hashes = await Promise.all(rows.map((r) => computeTxnHash(1, r, 0)));
    const unique = new Set(hashes);
    expect(unique.size).toBe(20000);
  }, 15000);
});
