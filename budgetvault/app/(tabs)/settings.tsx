import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { getDb } from '../../src/db';
import { getAccounts, getSetting, setSetting, upsertAccount } from '../../src/db/queries';
import { Account } from '../../src/types';

export default function SettingsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [currency, setCurrency] = useState('INR');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const db = await getDb();
      const [accs, reminder, cur] = await Promise.all([
        getAccounts(db),
        getSetting(db, 'reminder_enabled'),
        getSetting(db, 'currency'),
      ]);
      setAccounts(accs);
      setReminderEnabled(reminder !== 'false');
      setCurrency(cur ?? 'INR');
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleReminder(val: boolean) {
    setReminderEnabled(val);
    const db = await getDb();
    await setSetting(db, 'reminder_enabled', val ? 'true' : 'false');
  }

  async function addAccount() {
    const db = await getDb();
    await upsertAccount(db, { name: 'New Account', bank: 'generic_csv', kind: 'bank' });
    const updated = await getAccounts(db);
    setAccounts(updated);
    Alert.alert('Account Added', 'Edit the account name in a future update.');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionHeader}>Accounts</Text>
      <View style={styles.card}>
        {accounts.length === 0 ? (
          <Text style={styles.muted}>No accounts yet. Import a statement to create one.</Text>
        ) : (
          accounts.map((a) => (
            <View key={a.id} style={styles.row}>
              <View>
                <Text style={styles.rowTitle}>{a.name}</Text>
                <Text style={styles.rowSub}>{a.bank} · {a.kind}</Text>
              </View>
            </View>
          ))
        )}
        <TouchableOpacity style={styles.addBtn} onPress={addAccount}>
          <Text style={styles.addBtnText}>+ Add Account</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeader}>Reminders</Text>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <Text style={styles.rowTitle}>Weekly import reminder</Text>
          <Switch
            value={reminderEnabled}
            onValueChange={toggleReminder}
            trackColor={{ true: '#1A3C5E' }}
          />
        </View>
        <Text style={styles.muted}>Every Sunday at 6:00 PM (configurable in Phase 2)</Text>
      </View>

      <Text style={styles.sectionHeader}>Privacy</Text>
      <View style={styles.card}>
        <Text style={styles.rowTitle}>All data is stored on-device only</Text>
        <Text style={styles.muted}>No network calls are made for your financial data. Zero telemetry.</Text>
      </View>

      <Text style={styles.sectionHeader}>Backup</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.addBtn} onPress={() => Alert.alert('Coming in Phase 3', 'Export/restore will be available soon.')}>
          <Text style={styles.addBtnText}>Export Data (JSON/CSV)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.addBtn, { marginTop: 8 }]} onPress={() => Alert.alert('Coming in Phase 3', 'Restore from backup will be available soon.')}>
          <Text style={styles.addBtnText}>Restore from Backup</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeader}>About</Text>
      <View style={styles.card}>
        <Text style={styles.rowTitle}>BudgetVault v1.0.0</Text>
        <Text style={styles.muted}>Privacy-first local budget tracker. Your data never leaves your device.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 40 },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 1, marginBottom: 4 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowTitle: { fontSize: 15, color: '#1F2937', fontWeight: '600' },
  rowSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  muted: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
  addBtn: { marginTop: 12, padding: 12, backgroundColor: '#EFF6FF', borderRadius: 8, alignItems: 'center' },
  addBtnText: { color: '#1A3C5E', fontWeight: '700' },
});
