// Jest setup — provide a real SHA-256 implementation for expo-crypto
// The jest-expo preset auto-mocks native modules with empty stubs;
// this override ensures dedup hash tests produce real, unique values.
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_alg: string, payload: string): Promise<string> => {
    const { createHash } = require('crypto');
    return createHash('sha256').update(payload).digest('hex');
  },
}));
