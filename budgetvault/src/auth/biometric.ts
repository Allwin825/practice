import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricAuthResult =
  | { success: true }
  | { success: false; reason: 'not_available' | 'not_enrolled' | 'user_cancel' | 'failed' };

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function authenticateWithBiometric(
  promptMessage = 'Authenticate to access BudgetVault'
): Promise<BiometricAuthResult> {
  const available = await isBiometricAvailable();
  if (!available) {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return { success: false, reason: 'not_available' };
    return { success: false, reason: 'not_enrolled' };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
    fallbackLabel: 'Use Passcode',
  });

  if (result.success) {
    return { success: true };
  }

  // Distinguish user cancellation from actual failure
  if (
    result.error === 'user_cancel' ||
    result.error === 'system_cancel' ||
    result.error === 'app_cancel'
  ) {
    return { success: false, reason: 'user_cancel' };
  }

  return { success: false, reason: 'failed' };
}
