import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getDb } from '../../src/db';
import {
  addCategory,
  deleteCategory,
  getAccounts,
  getCategories,
  getImportHistory,
  getSetting,
  renameCategory,
  setSetting,
  upsertAccount,
} from '../../src/db/queries';
import {
  cancelWeeklyReminder,
  requestNotificationPermissions,
  scheduleWeeklyReminder,
} from '../../src/notifications';
import { isBiometricAvailable } from '../../src/auth/biometric';
import { exportData } from '../../src/backup/export';
import { restoreFromBackup } from '../../src/backup/restore';
import { useTheme } from '../../src/theme/ThemeContext';
import type { Account, Category } from '../../src/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = [6, 7, 8, 9, 17, 18, 19, 20, 21];

export default function SettingsScreen() {
  const { colors, mode, setMode, isDark } = useTheme();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDay, setReminderDay] = useState(0);
  const [reminderHour, setReminderHour] = useState(18);
  const [importHistory, setImportHistory] = useState<
    { id: number; file_name: string | null; imported_at: string; rows_inserted: number; rows_skipped_dupe: number }[]
  >([]);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const db = await getDb();
      const [accs, cats, reminder, day, hour, history, bioEnabled, bioSupported] = await Promise.all([
        getAccounts(db),
        getCategories(db),
        getSetting(db, 'reminder_enabled'),
        getSetting(db, 'reminder_day'),
        getSetting(db, 'reminder_hour'),
        getImportHistory(db, 5),
        getSetting(db, 'biometric_enabled'),
        isBiometricAvailable(),
      ]);
      setAccounts(accs);
      setCategories(cats);
      setReminderEnabled(reminder !== 'false');
      setReminderDay(parseInt(day ?? '0', 10));
      setReminderHour(parseInt(hour ?? '18', 10));
      setImportHistory(history);
      setBiometricSupported(bioSupported);
      setBiometricEnabled(bioEnabled === 'true');
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
    Alert.alert('Account Added', 'Account name editing coming soon.');
  }

  async function toggleBiometric(val: boolean) {
    setBiometricEnabled(val);
    const db = await getDb();
    await setSetting(db, 'biometric_enabled', val ? 'true' : 'false');
  }

  async function handleExport(format: 'json' | 'csv') {
    setExporting(true);
    try {
      const db = await getDb();
      await exportData(db, format);
    } catch (e: unknown) {
      Alert.alert('Export Failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setExporting(false);
    }
  }

  async function handleRestore() {
    Alert.alert(
      'Restore from Backup',
      'This will overwrite all your current data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setRestoring(true);
            try {
              const db = await getDb();
              const result = await restoreFromBackup(db);
              const summary = result.tablesRestored
                .map(t => `${t}: ${result.rowCounts[t]}`)
                .join(', ');
              Alert.alert('Restore Complete', `Restored: ${summary}`);
            } catch (e: unknown) {
              Alert.alert('Restore Failed', e instanceof Error ? e.message : 'Unknown error');
            } finally {
              setRestoring(false);
            }
          },
        },
      ]
    );
  }

  function formatDate(iso: string): string {
    return iso.slice(0, 10);
  }

  const s = makeStyles(colors);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Appearance */}
      <Text style={s.sectionHeader}>Appearance</Text>
      <View style={s.card}>
        <Text style={s.rowTitle}>Theme</Text>
        <View style={[s.chipRow, { marginTop: 8 }]}>
          {(['system', 'light', 'dark'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[s.chip, mode === m && s.chipActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[s.chipText, mode === m && s.chipTextActive]}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Security */}
      {biometricSupported && (
        <>
          <Text style={s.sectionHeader}>Security</Text>
          <View style={s.card}>
            <View style={s.switchRow}>
              <View>
                <Text style={s.rowTitle}>Biometric Lock</Text>
                <Text style={s.rowSub}>Lock app when backgrounded for 10s+</Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={toggleBiometric}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </>
      )}

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

      {/* Categories */}
      <Text style={s.sectionHeader}>Categories</Text>
      <View style={s.card}>
        {categories.length === 0 ? (
          <Text style={s.muted}>No categories yet.</Text>
        ) : (
          categories.map((cat) => (
            <View key={cat.id} style={s.listRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat.color ?? '#888', marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{cat.name}</Text>
                  <Text style={s.rowSub}>{cat.kind}</Text>
                </View>
              </View>
              {!cat.is_system && (
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert('Delete Category', `Delete "${cat.name}"? Transactions won't be affected.`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete', style: 'destructive',
                        onPress: async () => {
                          const db = await getDb();
                          await deleteCategory(db, cat.id);
                          setCategories(await getCategories(db));
                        },
                      },
                    ]);
                  }}
                  style={{ padding: 8 }}
                >
                  <Text style={{ color: '#e53e3e', fontSize: 16, fontWeight: '700' }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
        <TouchableOpacity style={s.addBtn} onPress={() => setCategoryModalVisible(true)}>
          <Text style={s.addBtnText}>+ Add Category</Text>
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
            trackColor={{ false: colors.border, true: colors.accent }}
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
      <Text style={s.sectionHeader}>Backup & Restore</Text>
      <View style={s.card}>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => handleExport('json')}
          disabled={exporting}
        >
          <Text style={s.addBtnText}>{exporting ? 'Exporting...' : 'Export Data (JSON)'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.addBtn, { marginTop: 8 }]}
          onPress={() => handleExport('csv')}
          disabled={exporting}
        >
          <Text style={s.addBtnText}>{exporting ? 'Exporting...' : 'Export Transactions (CSV)'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.addBtn, { marginTop: 8 }]}
          onPress={handleRestore}
          disabled={restoring}
        >
          <Text style={s.addBtnText}>{restoring ? 'Restoring...' : 'Restore from Backup'}</Text>
        </TouchableOpacity>
      </View>

      {/* About */}
      <Text style={s.sectionHeader}>About</Text>
      <View style={s.card}>
        <Text style={s.rowTitle}>BudgetVault v1.0.0</Text>
        <Text style={s.muted}>Privacy-first local budget tracker. Phase 3 — Banks & Polish.</Text>
      </View>

      <AddCategoryModal
        visible={categoryModalVisible}
        colors={colors}
        onClose={() => setCategoryModalVisible(false)}
        onAdd={async (name, kind) => {
          const db = await getDb();
          await addCategory(db, name, kind);
          setCategories(await getCategories(db));
          setCategoryModalVisible(false);
        }}
      />
    </ScrollView>
  );
}

function AddCategoryModal({
  visible, colors, onClose, onAdd,
}: {
  visible: boolean;
  colors: ReturnType<typeof import('../../src/theme/ThemeContext').useTheme>['colors'];
  onClose: () => void;
  onAdd: (name: string, kind: 'expense' | 'income' | 'transfer') => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a category name.');
      return;
    }
    setSaving(true);
    try {
      await onAdd(trimmed, kind);
      setName('');
      setKind('expense');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not add category.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Add Category</Text>
          <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 18, color: colors.textMuted, padding: 4 }}>✕</Text></TouchableOpacity>
        </View>
        <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4, fontWeight: '600', textTransform: 'uppercase' }}>Name</Text>
        <TextInput
          style={{ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 15, color: colors.text, marginBottom: 16 }}
          placeholder="e.g. Groceries"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          autoFocus
          maxLength={40}
        />
        <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6, fontWeight: '600', textTransform: 'uppercase' }}>Type</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {(['expense', 'income', 'transfer'] as const).map((k) => (
            <TouchableOpacity
              key={k}
              style={{
                flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center',
                backgroundColor: kind === k ? colors.accent : colors.surfaceAlt,
                borderWidth: 1, borderColor: kind === k ? colors.accent : colors.border,
              }}
              onPress={() => setKind(k)}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: kind === k ? '#fff' : colors.textSecondary }}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={{ backgroundColor: colors.accent, borderRadius: 10, padding: 14, alignItems: 'center', opacity: saving ? 0.6 : 1 }}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{saving ? 'Saving…' : 'Add Category'}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof import('../../src/theme/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, paddingBottom: 48 },
    sectionHeader: {
      fontSize: 11, fontWeight: '700', color: colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1,
      marginBottom: 8, marginTop: 20,
    },
    card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, elevation: 1 },
    listRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    },
    rowTitle: { fontSize: 15, color: colors.text, fontWeight: '600' },
    rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    rowBadge: {
      fontSize: 12, color: colors.textSecondary, backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    muted: { color: colors.textMuted, fontSize: 13, marginTop: 6, lineHeight: 18 },
    addBtn: { marginTop: 12, padding: 12, backgroundColor: colors.accentLight, borderRadius: 8, alignItems: 'center' },
    addBtnText: { color: colors.accentText, fontWeight: '700', fontSize: 14 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20,
      backgroundColor: colors.chipBg, borderWidth: 1, borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.chipActiveBg, borderColor: colors.chipActiveBg },
    chipText: { fontSize: 13, color: colors.textMuted },
    chipTextActive: { color: colors.chipActiveText, fontWeight: '600' },
  });
}
