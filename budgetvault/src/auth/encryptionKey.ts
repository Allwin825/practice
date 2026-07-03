import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const KEY_STORE_KEY = 'budgetvault.db_enc_key';

/**
 * Returns the DB encryption key, generating and persisting it on first run.
 *
 * The key is a 256-bit random value stored in expo-secure-store, backed by
 * Android Keystore / iOS Keychain and accessible only while the device is
 * unlocked (WHEN_UNLOCKED_THIS_DEVICE_ONLY).
 *
 * Integration note: when SQLCipher or an encrypted SQLite wrapper is added,
 * pass this key to the database open call. The key management lifecycle is
 * already in place.
 */
export async function getOrCreateEncryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_STORE_KEY);
  if (existing) return existing;

  const bytes = await Crypto.getRandomBytesAsync(32);
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  await SecureStore.setItemAsync(KEY_STORE_KEY, hex, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  return hex;
}

/**
 * Deletes the encryption key from secure storage.
 * Used during a full data wipe — without the key the DB is unreadable.
 */
export async function deleteEncryptionKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_STORE_KEY);
}

/**
 * Returns true if an encryption key has already been generated for this install.
 */
export async function hasEncryptionKey(): Promise<boolean> {
  const key = await SecureStore.getItemAsync(KEY_STORE_KEY);
  return key !== null;
}
