import { computeTxnHash, normalizeNarration, intraDayKey } from '../src/import/dedup';
import { RawTransaction } from '../src/types';

const BASE: RawTransaction = {
  txn_date: '2024-01-15',
  narration: 'SWIGGY ORDER',
  amount: 350,
  direction: 'debit',
};

describe('computeTxnHash', () => {
  test('identical inputs produce the same hash', async () => {
    const h1 = await computeTxnHash(1, BASE, 0);
    const h2 = await computeTxnHash(1, BASE, 0);
    expect(h1).toBe(h2);
  });

  test('different account_id → different hash', async () => {
    const h1 = await computeTxnHash(1, BASE, 0);
    const h2 = await computeTxnHash(2, BASE, 0);
    expect(h1).not.toBe(h2);
  });

  test('different intra_day_ordinal → different hash (two metro taps)', async () => {
    const h0 = await computeTxnHash(1, BASE, 0);
    const h1 = await computeTxnHash(1, BASE, 1);
    const h2 = await computeTxnHash(1, BASE, 2);
    expect(h0).not.toBe(h1);
    expect(h1).not.toBe(h2);
  });

  test('different amounts → different hash', async () => {
    const h1 = await computeTxnHash(1, BASE, 0);
    const h2 = await computeTxnHash(1, { ...BASE, amount: 351 }, 0);
    expect(h1).not.toBe(h2);
  });

  test('narration whitespace/case normalizes to same hash', async () => {
    const h1 = await computeTxnHash(1, { ...BASE, narration: 'SWIGGY ORDER' }, 0);
    const h2 = await computeTxnHash(1, { ...BASE, narration: 'swiggy  order' }, 0);
    expect(h1).toBe(h2);
  });

  test('debit vs credit → different hash', async () => {
    const h1 = await computeTxnHash(1, { ...BASE, direction: 'debit' }, 0);
    const h2 = await computeTxnHash(1, { ...BASE, direction: 'credit' }, 0);
    expect(h1).not.toBe(h2);
  });

  test('hash is 64-char hex (SHA-256)', async () => {
    const h = await computeTxnHash(1, BASE, 0);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  test('ref_no changes hash', async () => {
    const h1 = await computeTxnHash(1, { ...BASE, ref_no: 'REF001' }, 0);
    const h2 = await computeTxnHash(1, { ...BASE, ref_no: 'REF002' }, 0);
    expect(h1).not.toBe(h2);
  });

  test('absent vs present balance_after changes hash', async () => {
    const h1 = await computeTxnHash(1, BASE, 0);
    const h2 = await computeTxnHash(1, { ...BASE, balance_after: 10000 }, 0);
    expect(h1).not.toBe(h2);
  });

  // Golden-value stability test: pins the exact hash for the BASE fixture.
  // Payload: "1|2024-01-15|350.00|debit|SWIGGY ORDER|||0"
  // The amount field uses rupee floats (amount.toFixed(2)), NOT paise.
  // If this test breaks, dedup for previously-imported rows will silently change,
  // causing re-imports to insert duplicates instead of being deduped.
  test('hash is stable — BASE fixture matches known golden value', async () => {
    const hash = await computeTxnHash(1, BASE, 0);
    expect(hash).toBe('33afa0e7277b14a2cfd6b95f076c9046d7225d416c0e6f1bcfbeb7306f32e23d');
  });
});

describe('normalizeNarration', () => {
  test('uppercases and collapses whitespace', () => {
    expect(normalizeNarration('  swiggy  order  ')).toBe('SWIGGY ORDER');
  });
  test('handles tabs and newlines', () => {
    expect(normalizeNarration('UBER\tRIDE\nEATS')).toBe('UBER RIDE EATS');
  });
});

describe('intraDayKey', () => {
  test('same transaction produces same key', () => {
    expect(intraDayKey(BASE)).toBe(intraDayKey({ ...BASE }));
  });

  test('different narration → different key', () => {
    expect(intraDayKey(BASE)).not.toBe(intraDayKey({ ...BASE, narration: 'ZOMATO' }));
  });
});
