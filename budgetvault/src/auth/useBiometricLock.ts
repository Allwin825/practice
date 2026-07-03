import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { authenticateWithBiometric, isBiometricAvailable } from './biometric';

export type LockState = 'unlocked' | 'locked' | 'authenticating';

const LOCK_AFTER_BACKGROUND_MS = 10_000; // lock after 10s in background

export function useBiometricLock(enabled: boolean): {
  lockState: LockState;
  unlock: () => Promise<void>;
} {
  const [lockState, setLockState] = useState<LockState>('unlocked');
  const backgroundedAt = useRef<number | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const unlock = useCallback(async () => {
    const available = await isBiometricAvailable();
    if (!available) {
      setLockState('unlocked');
      return;
    }

    setLockState('authenticating');
    const result = await authenticateWithBiometric();

    if (result.success) {
      setLockState('unlocked');
    } else if (result.reason === 'user_cancel') {
      // Stay locked but don't retry in a loop — user intentionally cancelled
      setLockState('locked');
    } else {
      setLockState('locked');
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLockState('unlocked');
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appState.current;
      appState.current = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (nextState === 'active') {
        const elapsed = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        backgroundedAt.current = null;
        if (elapsed > LOCK_AFTER_BACKGROUND_MS || prev === 'background') {
          setLockState('locked');
        }
      }
    });

    return () => subscription.remove();
  }, [enabled]);

  return { lockState, unlock };
}
