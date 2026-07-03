import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getDb } from '../../src/db';
import { getCategories, getTransactionsByMonth, updateTransactionCategory } from '../../src/db/queries';
import { useTheme } from '../../src/theme/ThemeContext';
import type { ColorTokens } from '../../src/theme/tokens';
import type { Category, Transaction } from '../../src/types';

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function prevMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

type Direction = 'all' | 'debit' | 'credit';

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const [month, setMonth] = useState(currentMonth);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [dirFilter, setDirFilter] = useState<Direction>('all');
  const [catFilter, setCatFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [catFilterPickerVisible, setCatFilterPickerVisible] = useState(false);

  useEffect(() => { loadData(); }, [month]);

  async function loadData() {
    setLoading(true);
    try {
      const db = await getDb();
      const [txns, cats] = await Promise.all([
        getTransactionsByMonth(db, month),
        getCategories(db),
      ]);
      setTransactions(txns);
      setCategories(cats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCategoryChange(txnId: number, categoryId: number) {
    const db = await getDb();
    await updateTransactionCategory(db, txnId, categoryId, 'manual');
    setTransactions((prev) =>
      prev.map((t) => t.id === txnId ? { ...t, category_id: categoryId, category_source: 'manual' } : t)
    );
    setEditTxn(null);
  }

  const filtered = transactions.filter((t) => {
    if (dirFilter !== 'all' && t.direction !== dirFilter) return false;
    if (catFilter !== null && t.category_id !== catFilter) return false;
    if (search.trim() && !t.narration.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalDebit = filtered.reduce((s, t) => t.direction === 'debit' ? s + t.amount : s, 0);
  const totalCredit = filtered.reduce((s, t) => t.direction === 'credit' ? s + t.amount : s, 0);

  const catName = useCallback(
    (id: number | null) => id ? (categories.find((c) => c.id === id)?.name ?? 'Unknown') : 'Uncategorized',
    [categories]
  );

  const s = makeStyles(colors);

  return (
    <View style={s.container}>
      <View style={s.monthNav}>
        <TouchableOpacity onPress={() => setMonth(prevMonth(month))} style={s.navBtn}>
          <Text style={s.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.monthText}>{month}</Text>
        <TouchableOpacity onPress={() => setMonth(nextMonth(month))} style={s.navBtn}>
          <Text style={s.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={s.summaryStrip}>
        <Text style={s.summaryItem}>
          <Text style={s.summaryLabel}>In </Text>
          <Text style={{ color: colors.success, fontWeight: '700' }}>{formatINR(totalCredit)}</Text>
        </Text>
        <Text style={s.summaryItem}>
          <Text style={s.summaryLabel}>Out </Text>
          <Text style={{ color: colors.danger, fontWeight: '700' }}>{formatINR(totalDebit)}</Text>
        </Text>
        <Text style={s.summaryItem}>
          <Text style={s.summaryLabel}>{filtered.length} rows</Text>
        </Text>
      </View>

      <TextInput
        style={s.search}
        placeholder="Search narration..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      <View style={s.chips}>
        {(['all', 'debit', 'credit'] as Direction[]).map((d) => (
          <TouchableOpacity
            key={d}
            style={[s.chip, dirFilter === d && s.chipActive]}
            onPress={() => setDirFilter(d)}
          >
            <Text style={[s.chipText, dirFilter === d && s.chipTextActive]}>
              {d === 'all' ? 'All' : d === 'debit' ? 'Debit' : 'Credit'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[s.chip, catFilter !== null && s.chipActive]}
          onPress={() => catFilter !== null ? setCatFilter(null) : setCatFilterPickerVisible(true)}
        >
          <Text style={[s.chipText, catFilter !== null && s.chipTextActive]}>
            {catFilter !== null ? `× ${catName(catFilter)}` : 'Category ▾'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><Text style={s.muted}>Loading…</Text></View>
      ) : transactions.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>📂</Text>
          <Text style={s.emptyTitle}>No transactions yet</Text>
          <Text style={s.muted}>Import a bank statement to see your transactions here.</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>🔍</Text>
          <Text style={s.emptyTitle}>No results</Text>
          <Text style={s.muted}>Try adjusting your search or filters.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TxnRow
              txn={item}
              catName={catName(item.category_id)}
              onPress={() => setEditTxn(item)}
              colors={colors}
            />
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      {editTxn && (
        <EditTxnModal
          txn={editTxn}
          categories={categories}
          onSave={(catId) => handleCategoryChange(editTxn.id, catId)}
          onClose={() => setEditTxn(null)}
          colors={colors}
        />
      )}

      <CategoryFilterModal
        visible={catFilterPickerVisible}
        categories={categories}
        selectedId={catFilter}
        onSelect={(id) => { setCatFilter(id); setCatFilterPickerVisible(false); }}
        onClose={() => setCatFilterPickerVisible(false)}
        colors={colors}
      />
    </View>
  );
}

function TxnRow({
  txn, catName, onPress, colors,
}: { txn: Transaction; catName: string; onPress: () => void; colors: ColorTokens }) {
  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row', alignItems: 'center', padding: 13,
        borderBottomWidth: 1, borderBottomColor: colors.borderLight,
        backgroundColor: colors.surface,
        marginHorizontal: 10, marginBottom: 2, borderRadius: 8,
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '500' }} numberOfLines={2}>
          {txn.narration}
        </Text>
        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
          {txn.txn_date} · {catName}
        </Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: '700', color: txn.direction === 'debit' ? colors.danger : colors.success }}>
        {txn.direction === 'debit' ? '−' : '+'}{formatINR(txn.amount)}
      </Text>
    </TouchableOpacity>
  );
}

function EditTxnModal({
  txn, categories, onSave, onClose, colors,
}: {
  txn: Transaction;
  categories: Category[];
  onSave: (catId: number) => void;
  onClose: () => void;
  colors: ColorTokens;
}) {
  const grouped = groupBy(categories, (c) => c.kind);
  return (
    <Modal visible animationType="slide" transparent>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: '75%' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={2}>{txn.narration}</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{txn.txn_date} · {formatINR(txn.amount)}</Text>
          </View>
          <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 18, color: colors.textMuted, padding: 4 }}>✕</Text></TouchableOpacity>
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, textTransform: 'uppercase' }}>
          CHANGE CATEGORY
        </Text>
        <ScrollView>
          {(['expense', 'income', 'transfer'] as const).map((kind) =>
            (grouped[kind] ?? []).length > 0 ? (
              <View key={kind}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, textTransform: 'uppercase' }}>
                  {kind.toUpperCase()}
                </Text>
                {(grouped[kind] ?? []).map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 16, paddingVertical: 12,
                      borderBottomWidth: 1, borderBottomColor: colors.borderLight,
                      backgroundColor: cat.id === txn.category_id ? colors.accentLight : undefined,
                    }}
                    onPress={() => onSave(cat.id)}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, marginRight: 10, backgroundColor: cat.color ?? colors.textMuted }} />
                    <Text style={{ fontSize: 15, color: colors.textSecondary }}>{cat.name}</Text>
                    {cat.id === txn.category_id && <Text style={{ marginLeft: 'auto', color: colors.accent, fontWeight: '700' }}>✓</Text>}
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

function CategoryFilterModal({
  visible, categories, selectedId, onSelect, onClose, colors,
}: {
  visible: boolean;
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onClose: () => void;
  colors: ColorTokens;
}) {
  const grouped = groupBy(categories, (c) => c.kind);
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: '70%' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Filter by Category</Text>
          <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 18, color: colors.textMuted, padding: 4 }}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView>
          <TouchableOpacity
            style={{ paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: selectedId === null ? colors.accentLight : undefined }}
            onPress={() => onSelect(null)}
          >
            <Text style={{ fontSize: 15, color: colors.textSecondary }}>All categories</Text>
            {selectedId === null && <Text style={{ position: 'absolute', right: 16, top: 13, color: colors.accent, fontWeight: '700' }}>✓</Text>}
          </TouchableOpacity>
          {(['expense', 'income', 'transfer'] as const).map((kind) =>
            (grouped[kind] ?? []).length > 0 ? (
              <View key={kind}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, textTransform: 'uppercase' }}>{kind}</Text>
                {(grouped[kind] ?? []).map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: selectedId === cat.id ? colors.accentLight : undefined }}
                    onPress={() => onSelect(cat.id)}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, marginRight: 10, backgroundColor: cat.color ?? colors.textMuted }} />
                    <Text style={{ fontSize: 15, color: colors.textSecondary }}>{cat.name}</Text>
                    {selectedId === cat.id && <Text style={{ marginLeft: 'auto', color: colors.accent, fontWeight: '700' }}>✓</Text>}
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
    monthNav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 12, backgroundColor: colors.surface,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    navBtn: { padding: 8 },
    navArrow: { fontSize: 22, color: colors.accent, fontWeight: '700' },
    monthText: { fontSize: 16, fontWeight: '700', color: colors.text },
    summaryStrip: {
      flexDirection: 'row', justifyContent: 'space-around',
      backgroundColor: colors.surface, paddingVertical: 8,
      borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    },
    summaryItem: { fontSize: 13 },
    summaryLabel: { color: colors.textMuted },
    search: {
      margin: 10, marginBottom: 6, padding: 10,
      backgroundColor: colors.surface, borderRadius: 10,
      borderWidth: 1, borderColor: colors.border,
      fontSize: 14, color: colors.text,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 10, paddingBottom: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.chipBg, borderWidth: 1, borderColor: colors.border },
    chipActive: { backgroundColor: colors.chipActiveBg, borderColor: colors.chipActiveBg },
    chipText: { fontSize: 13, color: colors.textMuted },
    chipTextActive: { color: colors.chipActiveText, fontWeight: '600' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    muted: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  });
}
