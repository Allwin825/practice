// Unit tests for src/auth/encryptionKey.ts
// expo-secure-store is mocked below; expo-crypto uses the setup.ts mock.

const mockStoreMap = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlocked',
  getItemAsync: jest.fn(async (key: string) => mockStoreMap.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockStoreMap.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockStoreMap.delete(key); }),
}));

import {
  getOrCreateEncryptionKey,
  deleteEncryptionKey,
  hasEncryptionKey,
} from '../src/auth/encryptionKey';

beforeEach(() => {
  mockStoreMap.clear();
  jest.clearAllMocks();
});

describe('getOrCreateEncryptionKey', () => {
  it('generates a 64-character hex key on first call', async () => {
    const key = await getOrCreateEncryptionKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the same key on subsequent calls', async () => {
    const k1 = await getOrCreateEncryptionKey();
    const k2 = await getOrCreateEncryptionKey();
    expect(k2).toBe(k1);
  });

  it('generates different keys for different installs (store cleared)', async () => {
    const k1 = await getOrCreateEncryptionKey();
    mockStoreMap.clear();
    const k2 = await getOrCreateEncryptionKey();
    expect(k1).not.toBe(k2);
  });

  it('persists the key to SecureStore', async () => {
    const SecureStore = require('expo-secure-store');
    await getOrCreateEncryptionKey();
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync.mock.calls[0][2]).toMatchObject({
      keychainAccessible: 'whenUnlocked',
    });
  });

  it('does not call setItemAsync if key already exists', async () => {
    const SecureStore = require('expo-secure-store');
    await getOrCreateEncryptionKey();
    SecureStore.setItemAsync.mockClear();
    await getOrCreateEncryptionKey();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});

describe('deleteEncryptionKey', () => {
  it('removes the key so hasEncryptionKey returns false', async () => {
    await getOrCreateEncryptionKey();
    expect(await hasEncryptionKey()).toBe(true);
    await deleteEncryptionKey();
    expect(await hasEncryptionKey()).toBe(false);
  });

  it('is a no-op when no key exists', async () => {
    await expect(deleteEncryptionKey()).resolves.toBeUndefined();
  });
});

describe('hasEncryptionKey', () => {
  it('returns false before a key is generated', async () => {
    expect(await hasEncryptionKey()).toBe(false);
  });

  it('returns true after a key is generated', async () => {
    await getOrCreateEncryptionKey();
    expect(await hasEncryptionKey()).toBe(true);
  });
});
