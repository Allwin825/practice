// Jest setup — provide real crypto implementations for expo-crypto.
// The jest-expo preset auto-mocks native modules with empty stubs;
// these overrides ensure dedup hash and key-generation tests work correctly.
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_alg: string, payload: string): Promise<string> => {
    const { createHash } = require('crypto');
    return createHash('sha256').update(payload).digest('hex');
  },
  getRandomBytesAsync: async (byteCount: number): Promise<Uint8Array> => {
    const { randomBytes } = require('crypto');
    return new Uint8Array(randomBytes(byteCount));
  },
}));
