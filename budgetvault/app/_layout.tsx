import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getDb } from '../src/db';
import { getSetting } from '../src/db/queries';
import { requestNotificationPermissions, syncReminderFromSettings } from '../src/notifications';
import { useBiometricLock } from '../src/auth/useBiometricLock';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';

function AppShell() {
  const { colors } = useTheme();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const { lockState, unlock } = useBiometricLock(biometricEnabled);

  useEffect(() => {
    (async () => {
      try {
        const db = await getDb();
        const bioSetting = await getSetting(db, 'biometric_enabled');
        setBiometricEnabled(bioSetting === 'true');
        const granted = await requestNotificationPermissions();
        if (granted) syncReminderFromSettings();
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  if (lockState === 'locked' || lockState === 'authenticating') {
    return (
      <View style={[styles.lockScreen, { backgroundColor: colors.bg }]}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={[styles.lockTitle, { color: colors.text }]}>BudgetVault Locked</Text>
        <Text style={[styles.lockSub, { color: colors.textMuted }]}>
          Authenticate to access your financial data
        </Text>
        <TouchableOpacity
          style={[styles.unlockBtn, { backgroundColor: colors.accent }]}
          onPress={unlock}
          disabled={lockState === 'authenticating'}
        >
          <Text style={styles.unlockBtnText}>
            {lockState === 'authenticating' ? 'Authenticating...' : 'Unlock'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  lockScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  lockIcon: { fontSize: 48, marginBottom: 16 },
  lockTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  lockSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  unlockBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  unlockBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
