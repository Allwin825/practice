import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { getDb } from '../../src/db';
import { getAccounts, getCategories, upsertAccount } from '../../src/db/queries';
import { detectParser } from '../../src/import/detect';
import { buildReviewRows } from '../../src/categorize/engine';
import { commitReviewRows } from '../../src/import/commit';
import { saveLearntRule } from '../../src/categorize/engine';
import { useTheme } from '../../src/theme/ThemeContext';
import type { ColorTokens } from '../../src/theme/tokens';
import { currencySymbol, getLocaleConfig } from '../../src/utils/format';
import type { Account, Category, ReviewRow } from '../../src/types';

type Step = 'idle' | 'picking' | 'parsing' | 'review' | 'committing' | 'done';

function formatINR(n: number): string {
  return currencySymbol() + n.toLocaleString(getLocaleConfig().locale, { maximumFractionDigits: 2 });
}

function extractMerchantToken(narration: string): string {
  const upper = narration.toUpperCase().trim();
  const words = upper.split(/[\s\-\/|]+/);
  return words[0] ?? upper;
}

export default function ImportScreen() {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const s = makeStyles(colors);
  const [step, setStep] = useState<Step>('idle');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [pickerRowIndex, setPickerRowIndex] = useState<number | null>(null);
  const [accountPickerVisible, setAccountPickerVisible] = useState(false);
  const [commitProgress, setCommitProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (step === 'idle') loadMeta();
  }, [step]);

  async function loadMeta() {
    const db = await getDb();
    const [accs, cats] = await Promise.all([getAccounts(db), getCategories(db)]);
    setAccounts(accs);
    setCategories(cats);
  }

  async function pickFile() {
    setStep('picking');
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/plain',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) { setStep('idle'); return; }
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
      const ext = (name.split('.').pop() ?? '').toLowerCase();
      const meta = { name, extension: ext, size: 0, uri };
      const parser = detectParser(meta);
      if (!parser) {
        Alert.alert(
          'Unrecognized format',
          'This file format is not supported. Please use a CSV or XLSX bank statement.'
        );
        setStep('idle');
        return;
      }

      let content: string | ArrayBuffer;
      if (ext === 'xlsx' || ext === 'xls') {
        const b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        // Convert base64 to Uint8Array for SheetJS
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        content = bytes.buffer;
      } else {
        content = await FileSystem.readAsStringAsync(uri);
      }

      const rawTxns = await parser.parse(content, meta);
      if (rawTxns.length === 0) {
        Alert.alert('No transactions found', 'The file could not be parsed or has no data rows. Check the format.');
        setStep('idle');
        return;
      }

      const db = await getDb();
      const accs = await getAccounts(db);
      setAccounts(accs);

      let accountId = selectedAccountId;
      if (!accountId) {
        if (accs.length === 0) {
          accountId = await upsertAccount(db, { name: 'My Account', bank: ext === 'csv' ? 'generic_csv' : 'generic_xlsx', kind: 'bank' });
        } else {
          accountId = accs[0].id;
        }
        setSelectedAccountId(accountId);
      }

      const reviewRows = await buildReviewRows(db, accountId!, rawTxns);
      const cats = await getCategories(db);
      setCategories(cats);
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
      const dates = rows.filter((r) => !r.skip && !r.is_dupe).map((r) => r.txn_date).sort();
      setCommitProgress({ done: 0, total: rows.filter(r => !r.skip && !r.is_dupe).length });
      const res = await commitReviewRows(
        db, selectedAccountId, rows, fileName,
        dates[0] ?? null, dates[dates.length - 1] ?? null,
        (done, total) => setCommitProgress({ done, total })
      );

      // Offer to save learned rules for manually-changed categories
      const manualChanges = rows.filter(
        (r) => !r.skip && !r.is_dupe && r.category_source === 'manual' && r.suggested_category_id
      );
      for (const row of manualChanges) {
        const token = extractMerchantToken(row.narration);
        if (token.length >= 3) {
          await saveLearntRule(db, token, row.suggested_category_id!);
        }
      }

      setResult({ inserted: res.inserted, skipped: res.skipped });
      setStep('done');
    } catch (e) {
      Alert.alert('Commit failed', String(e));
      setStep('review');
    }
  }

  function toggleSkip(index: number) {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, skip: !r.skip } : r));
  }

  function openCategoryPicker(index: number) {
    if (rows[index]?.is_dupe) return;
    setPickerRowIndex(index);
    setCategoryPickerVisible(true);
  }

  function setRowCategory(categoryId: number | null) {
    if (pickerRowIndex === null) return;
    setRows((prev) =>
      prev.map((r, i) =>
        i === pickerRowIndex
          ? { ...r, suggested_category_id: categoryId, category_source: 'manual' }
          : r
      )
    );
    setCategoryPickerVisible(false);
    setPickerRowIndex(null);
  }

  function applyToAllMatching(index: number) {
    const target = rows[index];
    if (!target || target.is_dupe) return;
    const token = extractMerchantToken(target.narration);
    setRows((prev) =>
      prev.map((r) =>
        !r.is_dupe && extractMerchantToken(r.narration) === token
          ? { ...r, suggested_category_id: target.suggested_category_id, category_source: 'manual' }
          : r
      )
    );
  }

  const catName = useCallback(
    (id: number | null) => {
      if (!id) return '—';
      return categories.find((c) => c.id === id)?.name ?? '—';
    },
    [categories]
  );

  // ── Done screen ──────────────────────────────────────────────────────────────
  if (step === 'done' && result) {
    return (
      <View style={s.center}>
        <Text style={s.successIcon}>✓</Text>
        <Text style={s.successTitle}>Import Complete</Text>
        <Text style={s.successSub}>
          {result.inserted} new transaction{result.inserted !== 1 ? 's' : ''} added
        </Text>
        {result.skipped > 0 && (
          <Text style={s.muted}>{result.skipped} already stored (skipped)</Text>
        )}
        <TouchableOpacity
          style={s.btn}
          onPress={() => { setStep('idle'); setRows([]); setResult(null); }}
        >
          <Text style={s.btnText}>Import Another</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Review screen ─────────────────────────────────────────────────────────────
  if (step === 'review') {
    const newRows = rows.filter((r) => !r.is_dupe && !r.skip);
    const dupeCount = rows.filter((r) => r.is_dupe).length;

    return (
      <View style={s.container}>
        {/* Header */}
        <View style={s.reviewHeader}>
          <View>
            <Text style={s.reviewTitle}>Review {rows.length} rows</Text>
            <Text style={s.reviewSub}>
              {newRows.length} new · {dupeCount} already stored
            </Text>
          </View>
          {accounts.length > 1 && (
            <TouchableOpacity onPress={() => setAccountPickerVisible(true)} style={s.acctBtn}>
              <Text style={s.acctBtnText} numberOfLines={1}>
                {accounts.find((a) => a.id === selectedAccountId)?.name ?? 'Select account'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Rows */}
        <FlatList
          data={rows}
          keyExtractor={(item) => item.txn_hash}
          renderItem={({ item, index }) => (
            <ReviewRowItem
              row={item}
              index={index}
              catName={catName(item.suggested_category_id)}
              onToggleSkip={() => toggleSkip(index)}
              onPickCategory={() => openCategoryPicker(index)}
              onApplyToAll={() => applyToAllMatching(index)}
              colors={colors}
            />
          )}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
        />

        {/* Footer */}
        <View style={s.reviewFooter}>
          <TouchableOpacity
            style={[s.btn, s.btnSecondary]}
            onPress={() => setStep('idle')}
          >
            <Text style={[s.btnText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, newRows.length === 0 && s.btnDisabled]}
            onPress={confirmImport}
            disabled={newRows.length === 0}
          >
            <Text style={s.btnText}>
              Confirm {newRows.length} row{newRows.length !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>

        <CategoryPickerModal
          visible={categoryPickerVisible}
          categories={categories}
          onSelect={setRowCategory}
          onClose={() => setCategoryPickerVisible(false)}
          colors={colors}
        />

        <AccountPickerModal
          visible={accountPickerVisible}
          accounts={accounts}
          selectedId={selectedAccountId}
          onSelect={(id) => { setSelectedAccountId(id); setAccountPickerVisible(false); }}
          onClose={() => setAccountPickerVisible(false)}
          colors={colors}
        />
      </View>
    );
  }

  // ── Loading screens ──────────────────────────────────────────────────────────
  if (step === 'parsing' || step === 'committing') {
    const pct = commitProgress && commitProgress.total > 0
      ? commitProgress.done / commitProgress.total
      : 0;
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={s.muted}>
          {step === 'parsing' ? 'Parsing file…' : 'Saving transactions…'}
        </Text>
        {step === 'committing' && commitProgress && commitProgress.total > 0 && (
          <View style={{ marginTop: 20, width: screenWidth * 0.7 }}>
            <View style={{ height: 6, backgroundColor: colors.surfaceAlt, borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ height: 6, width: `${Math.round(pct * 100)}%`, backgroundColor: colors.accent, borderRadius: 3 }} />
            </View>
            <Text style={[s.muted, { textAlign: 'center', marginTop: 6 }]}>
              {commitProgress.done} / {commitProgress.total}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ── Idle screen ──────────────────────────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={s.idleContent}>
      <Text style={s.importTitle}>Import Bank Statement</Text>
      <Text style={s.muted}>
        Supports CSV and XLSX files.{'\n'}All parsing happens on-device — nothing leaves your phone.
      </Text>

      {accounts.length > 0 && (
        <View style={s.accountBox}>
          <Text style={s.accountLabel}>Import into:</Text>
          <TouchableOpacity onPress={() => setAccountPickerVisible(true)} style={s.accountSelector}>
            <Text style={s.accountSelectorText}>
              {accounts.find((a) => a.id === selectedAccountId)?.name ?? accounts[0]?.name ?? 'Select account'}
            </Text>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={[s.btn, s.btnLarge]} onPress={pickFile}>
        <Text style={s.btnText}>Pick File (CSV / XLSX)</Text>
      </TouchableOpacity>

      {accounts.length === 0 && (
        <Text style={[s.muted, { marginTop: 24, textAlign: 'center' }]}>
          A default account will be created automatically on first import.
        </Text>
      )}

      <AccountPickerModal
        visible={accountPickerVisible}
        accounts={accounts}
        selectedId={selectedAccountId}
        onSelect={(id) => { setSelectedAccountId(id); setAccountPickerVisible(false); }}
        onClose={() => setAccountPickerVisible(false)}
        colors={colors}
      />
    </ScrollView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ReviewRowItem({
  row, index, catName, onToggleSkip, onPickCategory, onApplyToAll, colors,
}: {
  row: ReviewRow;
  index: number;
  catName: string;
  onToggleSkip: () => void;
  onPickCategory: () => void;
  onApplyToAll: () => void;
  colors: ColorTokens;
}) {
  const s = makeStyles(colors);
  return (
    <View
      style={[
        s.reviewRow,
        row.is_dupe && s.dupeRow,
        !row.is_dupe && row.skip && s.skippedRow,
      ]}
    >
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={s.txnDate}>{row.txn_date}</Text>
        <Text style={s.txnNar} numberOfLines={2}>{row.narration}</Text>
        {!row.is_dupe ? (
          <View style={s.catRow}>
            <TouchableOpacity onPress={onPickCategory} style={s.catChip}>
              <Text style={s.catChipText} numberOfLines={1}>{catName}</Text>
              <Text style={s.catChipIcon}> ▾</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onApplyToAll} style={s.applyBtn}>
              <Text style={s.applyBtnText}>All</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={s.dupeBadge}>already stored</Text>
        )}
      </View>

      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text
          style={[
            s.txnAmount,
            { color: row.direction === 'debit' ? colors.danger : colors.success },
          ]}
        >
          {row.direction === 'debit' ? '−' : '+'}
          {formatINR(row.amount)}
        </Text>
        {!row.is_dupe && (
          <TouchableOpacity onPress={onToggleSkip} style={[s.skipToggle, row.skip && s.skipToggleActive]}>
            <Text style={[s.skipToggleText, row.skip && s.skipToggleTextActive]}>
              {row.skip ? 'Skipped' : 'Skip'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function CategoryPickerModal({
  visible, categories, onSelect, onClose, colors,
}: {
  visible: boolean;
  categories: Category[];
  onSelect: (id: number | null) => void;
  onClose: () => void;
  colors: ColorTokens;
}) {
  const s = makeStyles(colors);
  const grouped = groupBy(categories, (c) => c.kind);
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose} />
      <View style={s.modalSheet}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Select Category</Text>
          <TouchableOpacity onPress={onClose}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView>
          <TouchableOpacity style={s.catOption} onPress={() => onSelect(null)}>
            <Text style={s.catOptionText}>— Uncategorized</Text>
          </TouchableOpacity>
          {(['expense', 'income', 'transfer'] as const).map((kind) =>
            (grouped[kind] ?? []).length > 0 ? (
              <View key={kind}>
                <Text style={s.catGroupLabel}>{kind.toUpperCase()}</Text>
                {(grouped[kind] ?? []).map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={s.catOption}
                    onPress={() => onSelect(cat.id)}
                  >
                    <View style={[s.catDot, { backgroundColor: cat.color ?? colors.textMuted }]} />
                    <Text style={s.catOptionText}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function AccountPickerModal({
  visible, accounts, selectedId, onSelect, onClose, colors,
}: {
  visible: boolean;
  accounts: Account[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onClose: () => void;
  colors: ColorTokens;
}) {
  const s = makeStyles(colors);
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose} />
      <View style={s.modalSheet}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Select Account</Text>
          <TouchableOpacity onPress={onClose}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        {accounts.map((a) => (
          <TouchableOpacity
            key={a.id}
            style={[s.catOption, a.id === selectedId && s.selectedOption]}
            onPress={() => onSelect(a.id)}
          >
            <Text style={s.catOptionText}>{a.name}</Text>
            <Text style={s.accountSubText}>{a.bank} · {a.kind}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    idleContent: { alignItems: 'center', padding: 32, paddingTop: 60 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },

    importTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 8, textAlign: 'center' },
    muted: { color: colors.textMuted, fontSize: 14, marginTop: 4, textAlign: 'center', lineHeight: 20 },

    accountBox: { width: '100%', backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginTop: 24, borderWidth: 1, borderColor: colors.border },
    accountLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6, fontWeight: '600', textTransform: 'uppercase' },
    accountSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    accountSelectorText: { fontSize: 16, color: colors.text, fontWeight: '600' },
    chevron: { fontSize: 20, color: colors.textMuted },

    btn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 13, marginTop: 16, alignItems: 'center' },
    btnLarge: { paddingHorizontal: 48, paddingVertical: 16, marginTop: 24, width: '100%' },
    btnSecondary: { backgroundColor: colors.surfaceAlt },
    btnDisabled: { backgroundColor: colors.textMuted },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

    reviewHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    reviewTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    reviewSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    acctBtn: { backgroundColor: colors.accentLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, maxWidth: 140 },
    acctBtnText: { color: colors.accentText, fontSize: 13, fontWeight: '600' },

    reviewRow: {
      flexDirection: 'row', padding: 12, borderBottomWidth: 1,
      borderBottomColor: colors.borderLight, backgroundColor: colors.surface,
    },
    dupeRow: { backgroundColor: colors.surfaceAlt, opacity: 0.55 },
    skippedRow: { opacity: 0.45 },
    txnDate: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
    txnNar: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
    txnAmount: { fontSize: 14, fontWeight: '700' },

    catRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    catChip: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accentLight,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, maxWidth: 140,
    },
    catChipText: { fontSize: 12, color: colors.accentText, fontWeight: '600', flexShrink: 1 },
    catChipIcon: { fontSize: 11, color: colors.accentText },
    applyBtn: { backgroundColor: colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    applyBtnText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },

    dupeBadge: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },

    skipToggle: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 6,
      paddingHorizontal: 10, paddingVertical: 3,
    },
    skipToggleActive: { backgroundColor: colors.warningBg, borderColor: colors.warning },
    skipToggleText: { fontSize: 12, color: colors.textMuted },
    skipToggleTextActive: { color: colors.warningText, fontWeight: '600' },

    reviewFooter: {
      flexDirection: 'row', gap: 10, padding: 14,
      backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    modalSheet: {
      backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingBottom: 32, maxHeight: '75%',
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    modalClose: { fontSize: 18, color: colors.textMuted, padding: 4 },

    catGroupLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, textTransform: 'uppercase' },
    catOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
    catOptionText: { fontSize: 15, color: colors.textSecondary },
    catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    selectedOption: { backgroundColor: colors.accentLight },
    accountSubText: { fontSize: 12, color: colors.textMuted, marginLeft: 'auto' },

    successIcon: { fontSize: 56, color: colors.success },
    successTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 8 },
    successSub: { fontSize: 16, color: colors.textSecondary, marginTop: 4 },
  });
}
