import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { getDb } from '../src/db';

export default function RootLayout() {
  useEffect(() => {
    // Initialize DB on app start
    getDb().catch(console.error);
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
