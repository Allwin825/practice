import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { getDb } from '../../src/db';
import { getAccounts, upsertAccount } from '../../src/db/queries';
import { detectParser } from '../../src/import/detect';
import { buildReviewRows } from '../../src/categorize/engine';
import { commitReviewRows } from '../../src/import/commit';
import { Account, ReviewRow } from '../../src/types';
import * as FileSystem from 'expo-file-system';

type Step = 'idle' | 'picking' | 'parsing' | 'review' | 'committing' | 'done';

function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function ImportScreen() {
  const [step, setStep] = useState<Step>('idle');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);

  async function pickFile() {
    setStep('picking');
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/vnd.ms-excel',
               'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) {
        setStep('idle');
        return;
      }
      const asset = picked.assets[0];
      setFileName(asset.name);
      await parseFile(asset.uri, asset.name);
    } catch (e) {
      Alert.alert('Error', String(e));
      setStep('idle');
    }
  }

  async function parseFile(uri: string, name: string) {
    setStep('parsing');
    try {
      const ext = name.split('.').pop() ?? '';
      const meta = { name, extension: ext, size: 0, uri };
      const parser = detectParser(meta);
      const content = await FileSystem.readAsStringAsync(uri);
      const rawTxns = await parser.parse(content, meta);
      if (rawTxns.length === 0) {
        Alert.alert('No transactions found', 'The file could not be parsed or has no data rows.');
        setStep('idle');
        return;
      }

      const db = await getDb();
      const accs = await getAccounts(db);
      setAccounts(accs);

      let accountId = selectedAccountId;
      if (!accountId) {
        if (accs.length === 0) {
          accountId = await upsertAccount(db, { name: 'My Account', bank: 'generic_csv', kind: 'bank' });
          setSelectedAccountId(accountId);
        } else {
          accountId = accs[0].id;
          setSelectedAccountId(accountId);
        }
      }

      const reviewRows = await buildReviewRows(db, accountId, rawTxns);
      setRows(reviewRows);
      setStep('review');
    } catch (e) {
      Alert.alert('Parse error', String(e));
      setStep('idle');
    }
  }

  async function confirmImport() {
    if (!selectedAccountId) return;
    setStep('committing');
    try {
      const db = await getDb();
      const dates = rows.map((r) => r.txn_date).sort();
      const res = await commitReviewRows(
        db,
        selectedAccountId,
        rows,
        fileName,
        dates[0] ?? null,
        dates[dates.length - 1] ?? null
      );
      setResult({ inserted: res.inserted, skipped: res.skipped });
      setStep('done');
    } catch (e) {
      Alert.alert('Commit failed', String(e));
      setStep('review');
    }
  }

  function toggleSkip(index: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, skip: !r.skip } : r))
    );
  }

  if (step === 'done' && result) {
    return (
      <View style={styles.center}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successTitle}>Import Complete</Text>
        <Text style={styles.successSub}>
          {result.inserted} new transaction{result.inserted !== 1 ? 's' : ''} imported
        </Text>
        {result.skipped > 0 && (
          <Text style={styles.muted}>{result.skipped} already stored (skipped)</Text>
        )}
        <TouchableOpacity style={styles.btn} onPress={() => { setStep('idle'); setRows([]); setResult(null); }}>
          <Text style={styles.btnText}>Import Another</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'review') {
    const newRows = rows.filter((r) => !r.is_dupe && !r.skip);
    const dupeRows = rows.filter((r) => r.is_dupe);
    return (
      <View style={styles.container}>
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewTitle}>Review {rows.length} rows</Text>
          <Text style={styles.reviewSub}>
            {newRows.length} new · {dupeRows.length} already stored
          </Text>
        </View>
        <ScrollView style={{ flex: 1 }}>
          {rows.map((row, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.reviewRow, row.is_dupe && styles.dupeRow, row.skip && styles.skippedRow]}
              onPress={() => toggleSkip(i)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.txnDate}>{row.txn_date}</Text>
                <Text style={styles.txnNar} numberOfLines={1}>{row.narration}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.txnAmount, { color: row.direction === 'debit' ? '#EF4444' : '#22C55E' }]}>
                  {row.direction === 'debit' ? '-' : '+'}{formatINR(row.amount)}
                </Text>
                {row.is_dupe && <Text style={styles.dupeBadge}>stored</Text>}
                {row.skip && !row.is_dupe && <Text style={styles.skipBadge}>skip</Text>}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.reviewFooter}>
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setStep('idle')}>
            <Text style={[styles.btnText, { color: '#374151' }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={confirmImport} disabled={newRows.length === 0}>
            <Text style={styles.btnText}>Confirm {newRows.length} rows</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 'parsing' || step === 'committing') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A3C5E" />
        <Text style={styles.muted}>{step === 'parsing' ? 'Parsing file...' : 'Saving transactions...'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Text style={styles.importTitle}>Import Bank Statement</Text>
      <Text style={styles.muted}>Supports CSV files. All processing happens on-device.</Text>
      <TouchableOpacity style={[styles.btn, styles.btnLarge]} onPress={pickFile}>
        <Text style={styles.btnText}>Pick File</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F9FAFB' },
  importTitle: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  muted: { color: '#9CA3AF', fontSize: 14, marginTop: 4 },
  btn: {
    backgroundColor: '#1A3C5E', borderRadius: 10, paddingHorizontal: 24,
    paddingVertical: 12, marginTop: 16, alignItems: 'center',
  },
  btnLarge: { paddingHorizontal: 48, paddingVertical: 16, marginTop: 24 },
  btnSecondary: { backgroundColor: '#E5E7EB' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  reviewHeader: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  reviewTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  reviewSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  reviewRow: {
    flexDirection: 'row', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    backgroundColor: '#fff',
  },
  dupeRow: { backgroundColor: '#F3F4F6', opacity: 0.6 },
  skippedRow: { opacity: 0.4 },
  txnDate: { fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  txnNar: { fontSize: 13, color: '#374151' },
  txnAmount: { fontSize: 14, fontWeight: '700' },
  dupeBadge: { fontSize: 10, color: '#6B7280', backgroundColor: '#E5E7EB', borderRadius: 4, paddingHorizontal: 4 },
  skipBadge: { fontSize: 10, color: '#92400E', backgroundColor: '#FEF3C7', borderRadius: 4, paddingHorizontal: 4 },
  reviewFooter: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  successIcon: { fontSize: 48, color: '#22C55E' },
  successTitle: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginTop: 8 },
  successSub: { fontSize: 16, color: '#374151', marginTop: 4 },
});
