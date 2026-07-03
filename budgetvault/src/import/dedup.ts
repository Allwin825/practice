import * as Crypto from 'expo-crypto';
import { RawTransaction } from '../types';

export function normalizeNarration(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, ' ').trim();
}

function buildPayload(
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
  return parts.join('|');
}

export async function computeTxnHash(
  accountId: number,
  txn: RawTransaction,
  intraDayOrdinal: number
): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    buildPayload(accountId, txn, intraDayOrdinal)
  );
}

export function intraDayKey(txn: RawTransaction): string {
  return [
    txn.txn_date,
    txn.amount.toFixed(2),
    txn.direction,
    normalizeNarration(txn.narration),
    txn.ref_no ?? '',
    txn.balance_after !== undefined && txn.balance_after !== null
      ? txn.balance_after.toFixed(2)
      : '',
  ].join('|');
}
