import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { getDb } from '../../src/db';
import {
  getAccounts,
  getImportHistory,
  getSetting,
  setSetting,
  upsertAccount,
} from '../../src/db/queries';
import {
  cancelWeeklyReminder,
  requestNotificationPermissions,
  scheduleWeeklyReminder,
} from '../../src/notifications';
import type { Account } from '../../src/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = [6, 7, 8, 9, 17, 18, 19, 20, 21];

export default function SettingsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDay, setReminderDay] = useState(0); // 0=Sun
  const [reminderHour, setReminderHour] = useState(18);
  const [importHistory, setImportHistory] = useState<
    { id: number; file_name: string | null; imported_at: string; rows_inserted: number; rows_skipped_dupe: number }[]
  >([]);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const db = await getDb();
      const [accs, reminder, day, hour, history] = await Promise.all([
        getAccounts(db),
        getSetting(db, 'reminder_enabled'),
        getSetting(db, 'reminder_day'),
        getSetting(db, 'reminder_hour'),
        getImportHistory(db, 5),
      ]);
      setAccounts(accs);
      setReminderEnabled(reminder !== 'false');
      setReminderDay(parseInt(day ?? '0', 10));
      setReminderHour(parseInt(hour ?? '18', 10));
      setImportHistory(history);
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleReminder(val: boolean) {
    setReminderEnabled(val);
    const db = await getDb();
    await setSetting(db, 'reminder_enabled', val ? 'true' : 'false');
    if (val) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Permission needed', 'Enable notifications in your device settings to receive reminders.');
        setReminderEnabled(false);
        await setSetting(db, 'reminder_enabled', 'false');
        return;
      }
      // weekday for expo-notifications: 1=Sunday
      await scheduleWeeklyReminder(reminderDay === 0 ? 1 : reminderDay + 1, reminderHour, 0);
    } else {
      await cancelWeeklyReminder();
    }
  }

  async function changeDay(day: number) {
    setReminderDay(day);
    const db = await getDb();
    await setSetting(db, 'reminder_day', String(day));
    if (reminderEnabled) {
      await scheduleWeeklyReminder(day === 0 ? 1 : day + 1, reminderHour, 0).catch(console.error);
    }
  }

  async function changeHour(hour: number) {
    setReminderHour(hour);
    const db = await getDb();
    await setSetting(db, 'reminder_hour', String(hour));
    if (reminderEnabled) {
      await scheduleWeeklyReminder(reminderDay === 0 ? 1 : reminderDay + 1, hour, 0).catch(console.error);
    }
  }

  async function addAccount() {
    const db = await getDb();
    await upsertAccount(db, { name: 'New Account', bank: 'generic_csv', kind: 'bank' });
    const updated = await getAccounts(db);
    setAccounts(updated);
    Alert.alert('Account Added', 'Account name editing coming in Phase 3.');
  }

  function formatDate(iso: string): string {
    return iso.slice(0, 10);
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Accounts */}
      <Text style={s.sectionHeader}>Accounts</Text>
      <View style={s.card}>
        {accounts.length === 0 ? (
          <Text style={s.muted}>No accounts yet. Import a statement to create one.</Text>
        ) : (
          accounts.map((a) => (
            <View key={a.id} style={s.listRow}>
              <View>
                <Text style={s.rowTitle}>{a.name}</Text>
                <Text style={s.rowSub}>{a.bank} · {a.kind}</Text>
              </View>
            </View>
          ))
        )}
        <TouchableOpacity style={s.addBtn} onPress={addAccount}>
          <Text style={s.addBtnText}>+ Add Account</Text>
        </TouchableOpacity>
      </View>

      {/* Reminder */}
      <Text style={s.sectionHeader}>Weekly Reminder</Text>
      <View style={s.card}>
        <View style={s.switchRow}>
          <Text style={s.rowTitle}>Import reminder</Text>
          <Switch
            value={reminderEnabled}
            onValueChange={toggleReminder}
            trackColor={{ false: '#E5E7EB', true: '#1A3C5E' }}
            thumbColor="#fff"
          />
        </View>

        {reminderEnabled && (
          <>
            <Text style={[s.rowSub, { marginTop: 12, marginBottom: 6 }]}>Day of week</Text>
            <View style={s.chipRow}>
              {DAYS.map((d, i) => (
                <TouchableOpacity
                  key={d}
                  style={[s.chip, reminderDay === i && s.chipActive]}
                  onPress={() => changeDay(i)}
                >
                  <Text style={[s.chipText, reminderDay === i && s.chipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.rowSub, { marginTop: 12, marginBottom: 6 }]}>Time</Text>
            <View style={s.chipRow}>
              {HOURS.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[s.chip, reminderHour === h && s.chipActive]}
                  onPress={() => changeHour(h)}
                >
                  <Text style={[s.chipText, reminderHour === h && s.chipTextActive]}>
                    {h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>

      {/* Import history */}
      {importHistory.length > 0 && (
        <>
          <Text style={s.sectionHeader}>Recent Imports</Text>
          <View style={s.card}>
            {importHistory.map((h) => (
              <View key={h.id} style={s.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {h.file_name ?? 'Unknown file'}
                  </Text>
                  <Text style={s.rowSub}>{formatDate(h.imported_at)}</Text>
                </View>
                <Text style={s.rowBadge}>
                  +{h.rows_inserted} / {h.rows_skipped_dupe} dup
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Privacy */}
      <Text style={s.sectionHeader}>Privacy</Text>
      <View style={s.card}>
        <Text style={s.rowTitle}>100% on-device</Text>
        <Text style={s.muted}>
          No analytics, no telemetry, no remote API calls for your data. All processing and storage happens locally.
        </Text>
      </View>

      {/* Backup */}
      <Text style={s.sectionHeader}>Backup</Text>
      <View style={s.card}>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => Alert.alert('Coming in Phase 3', 'Export your full database as JSON or CSV.')}
        >
          <Text style={s.addBtnText}>Export Data (JSON / CSV)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.addBtn, { marginTop: 8 }]}
          onPress={() => Alert.alert('Coming in Phase 3', 'Restore from a previously exported backup.')}
        >
          <Text style={s.addBtnText}>Restore from Backup</Text>
        </TouchableOpacity>
      </View>

      {/* About */}
      <Text style={s.sectionHeader}>About</Text>
      <View style={s.card}>
        <Text style={s.rowTitle}>BudgetVault v1.0.0</Text>
        <Text style={s.muted}>Privacy-first local budget tracker. Phase 2 — Budget & Dashboard.</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 48 },
  sectionHeader: {
    fontSize: 11, fontWeight: '700', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 8, marginTop: 20,
  },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 1 },
  listRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  rowTitle: { fontSize: 15, color: '#1F2937', fontWeight: '600' },
  rowSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  rowBadge: { fontSize: 12, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { color: '#9CA3AF', fontSize: 13, marginTop: 6, lineHeight: 18 },
  addBtn: { marginTop: 12, padding: 12, backgroundColor: '#EFF6FF', borderRadius: 8, alignItems: 'center' },
  addBtnText: { color: '#1A3C5E', fontWeight: '700', fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#1A3C5E', borderColor: '#1A3C5E' },
  chipText: { fontSize: 13, color: '#6B7280' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
});
