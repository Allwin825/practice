import * as Crypto from 'expo-crypto';
import { RawTransaction } from '../types';

function normalizeNarration(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeTxnHash(
  accountId: number,
  txn: RawTransaction,
  intraDayOrdinal: number
): string {
  const parts = [
    String(accountId),
    txn.txn_date,
    txn.amount.toFixed(2),
    txn.direction,
    normalizeNarration(txn.narration),
    txn.ref_no ?? '',
    txn.balance_after !== undefined && txn.balance_after !== null
      ? txn.balance_after.toFixed(2)
      : '',
    String(intraDayOrdinal),
  ];
  const payload = parts.join('|');
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    payload
  ) as unknown as string;
}

export async function computeTxnHashAsync(
  accountId: number,
  txn: RawTransaction,
  intraDayOrdinal: number
): Promise<string> {
  const parts = [
    String(accountId),
    txn.txn_date,
    txn.amount.toFixed(2),
    txn.direction,
    normalizeNarration(txn.narration),
    txn.ref_no ?? '',
    txn.balance_after !== undefined && txn.balance_after !== null
      ? txn.balance_after.toFixed(2)
      : '',
    String(intraDayOrdinal),
  ];
  const payload = parts.join('|');
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
}
