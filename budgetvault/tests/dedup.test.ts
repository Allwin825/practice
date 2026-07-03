import { computeTxnHashAsync } from '../src/import/dedup';
import { RawTransaction } from '../src/types';

const BASE: RawTransaction = {
  txn_date: '2024-01-15',
  narration: 'SWIGGY ORDER',
  amount: 350,
  direction: 'debit',
};

describe('txn_hash dedup', () => {
  test('identical transactions produce the same hash', async () => {
    const h1 = await computeTxnHashAsync(1, BASE, 0);
    const h2 = await computeTxnHashAsync(1, BASE, 0);
    expect(h1).toBe(h2);
  });

  test('different account_id produces different hash', async () => {
    const h1 = await computeTxnHashAsync(1, BASE, 0);
    const h2 = await computeTxnHashAsync(2, BASE, 0);
    expect(h1).not.toBe(h2);
  });

  test('different intra_day_ordinal produces different hash (two metro taps)', async () => {
    const h0 = await computeTxnHashAsync(1, BASE, 0);
    const h1 = await computeTxnHashAsync(1, BASE, 1);
    expect(h0).not.toBe(h1);
  });

  test('different amounts produce different hash', async () => {
    const h1 = await computeTxnHashAsync(1, BASE, 0);
    const h2 = await computeTxnHashAsync(1, { ...BASE, amount: 351 }, 0);
    expect(h1).not.toBe(h2);
  });

  test('narration whitespace normalizes to same hash', async () => {
    const h1 = await computeTxnHashAsync(1, { ...BASE, narration: 'SWIGGY ORDER' }, 0);
    const h2 = await computeTxnHashAsync(1, { ...BASE, narration: 'swiggy  order' }, 0);
    expect(h1).toBe(h2);
  });

  test('debit vs credit produces different hash', async () => {
    const h1 = await computeTxnHashAsync(1, { ...BASE, direction: 'debit' }, 0);
    const h2 = await computeTxnHashAsync(1, { ...BASE, direction: 'credit' }, 0);
    expect(h1).not.toBe(h2);
  });

  test('hash is a 64-char hex string (SHA-256)', async () => {
    const h = await computeTxnHashAsync(1, BASE, 0);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
