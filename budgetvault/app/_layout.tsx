import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { getDb } from '../src/db';
import { requestNotificationPermissions, syncReminderFromSettings } from '../src/notifications';

export default function RootLayout() {
  useEffect(() => {
    getDb()
      .then(() => requestNotificationPermissions())
      .then((granted) => { if (granted) syncReminderFromSettings(); })
      .catch(console.error);
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
