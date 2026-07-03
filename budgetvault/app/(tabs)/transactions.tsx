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
import { invalidateRulesCache } from '../../src/categorize/engine';
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
  const [month, setMonth] = useState(currentMonth);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [dirFilter, setDirFilter] = useState<Direction>('all');
  const [catFilter, setCatFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);

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

  return (
    <View style={s.container}>
      {/* Month nav */}
      <View style={s.monthNav}>
        <TouchableOpacity onPress={() => setMonth(prevMonth(month))} style={s.navBtn}>
          <Text style={s.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.monthText}>{month}</Text>
        <TouchableOpacity onPress={() => setMonth(nextMonth(month))} style={s.navBtn}>
          <Text style={s.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Summary strip */}
      <View style={s.summaryStrip}>
        <Text style={s.summaryItem}>
          <Text style={s.summaryLabel}>In </Text>
          <Text style={{ color: '#22C55E', fontWeight: '700' }}>{formatINR(totalCredit)}</Text>
        </Text>
        <Text style={s.summaryItem}>
          <Text style={s.summaryLabel}>Out </Text>
          <Text style={{ color: '#EF4444', fontWeight: '700' }}>{formatINR(totalDebit)}</Text>
        </Text>
        <Text style={s.summaryItem}>
          <Text style={s.summaryLabel}>{filtered.length} rows</Text>
        </Text>
      </View>

      {/* Search */}
      <TextInput
        style={s.search}
        placeholder="Search narration..."
        placeholderTextColor="#9CA3AF"
        value={search}
        onChangeText={setSearch}
      />

      {/* Direction filter chips */}
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
          onPress={() => setCatFilter(null)}
        >
          <Text style={[s.chipText, catFilter !== null && s.chipTextActive]}>
            {catFilter !== null ? `× ${catName(catFilter)}` : 'All categories'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><Text style={s.muted}>Loading...</Text></View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={s.muted}>No transactions match your filters.</Text>
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
            />
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      {/* Edit category modal */}
      {editTxn && (
        <EditTxnModal
          txn={editTxn}
          categories={categories}
          onSave={(catId) => handleCategoryChange(editTxn.id, catId)}
          onClose={() => setEditTxn(null)}
        />
      )}
    </View>
  );
}

function TxnRow({
  txn, catName, onPress,
}: { txn: Transaction; catName: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={s.narration} numberOfLines={2}>{txn.narration}</Text>
        <Text style={s.meta}>{txn.txn_date} · {catName}</Text>
      </View>
      <Text style={[s.amount, { color: txn.direction === 'debit' ? '#EF4444' : '#22C55E' }]}>
        {txn.direction === 'debit' ? '−' : '+'}{formatINR(txn.amount)}
      </Text>
    </TouchableOpacity>
  );
}

function EditTxnModal({
  txn, categories, onSave, onClose,
}: {
  txn: Transaction;
  categories: Category[];
  onSave: (catId: number) => void;
  onClose: () => void;
}) {
  const grouped = groupBy(categories, (c) => c.kind);
  return (
    <Modal visible animationType="slide" transparent>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose} />
      <View style={s.modalSheet}>
        <View style={s.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.modalTitle} numberOfLines={2}>{txn.narration}</Text>
            <Text style={s.modalSub}>{txn.txn_date} · {formatINR(txn.amount)}</Text>
          </View>
          <TouchableOpacity onPress={onClose}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <Text style={s.catGroupLabel}>CHANGE CATEGORY</Text>
        <ScrollView>
          {(['expense', 'income', 'transfer'] as const).map((kind) =>
            (grouped[kind] ?? []).length > 0 ? (
              <View key={kind}>
                <Text style={s.catGroupLabel}>{kind.toUpperCase()}</Text>
                {(grouped[kind] ?? []).map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[s.catOption, cat.id === txn.category_id && s.selectedOption]}
                    onPress={() => onSave(cat.id)}
                  >
                    <View style={[s.catDot, { backgroundColor: cat.color ?? '#9CA3AF' }]} />
                    <Text style={s.catOptionText}>{cat.name}</Text>
                    {cat.id === txn.category_id && <Text style={s.checkmark}>✓</Text>}
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  navBtn: { padding: 8 },
  navArrow: { fontSize: 22, color: '#1A3C5E', fontWeight: '700' },
  monthText: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  summaryStrip: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: '#fff', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  summaryItem: { fontSize: 13 },
  summaryLabel: { color: '#9CA3AF' },
  search: {
    margin: 10, marginBottom: 6, padding: 10, backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB', fontSize: 14, color: '#1F2937',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 10, paddingBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#1A3C5E', borderColor: '#1A3C5E' },
  chipText: { fontSize: 13, color: '#6B7280' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#9CA3AF', fontSize: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 13,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#fff',
    marginHorizontal: 10, marginBottom: 2, borderRadius: 8,
  },
  narration: { fontSize: 13, color: '#374151', fontWeight: '500' },
  meta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 40, maxHeight: '75%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 8 },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  modalSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  modalClose: { fontSize: 18, color: '#9CA3AF', padding: 4 },
  catGroupLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, textTransform: 'uppercase' },
  catOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  catOptionText: { fontSize: 15, color: '#374151' },
  catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  selectedOption: { backgroundColor: '#EFF6FF' },
  checkmark: { marginLeft: 'auto', color: '#1A3C5E', fontWeight: '700' },
});
