import { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getDb } from '../../src/db';
import { getTransactionsByMonth } from '../../src/db/queries';
import { Transaction } from '../../src/types';

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

export default function TransactionsScreen() {
  const [month, setMonth] = useState(currentMonth);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, [month]);

  async function loadTransactions() {
    setLoading(true);
    try {
      const db = await getDb();
      const txns = await getTransactionsByMonth(db, month);
      setTransactions(txns);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = search.trim()
    ? transactions.filter((t) =>
        t.narration.toLowerCase().includes(search.toLowerCase())
      )
    : transactions;

  return (
    <View style={styles.container}>
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setMonth(prevMonth(month))} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthText}>{month}</Text>
        <TouchableOpacity onPress={() => setMonth(nextMonth(month))} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search transactions..."
        placeholderTextColor="#9CA3AF"
        value={search}
        onChangeText={setSearch}
      />

      {loading ? (
        <View style={styles.center}><Text style={styles.muted}>Loading...</Text></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>No transactions for {month}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <TxnRow txn={item} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

function TxnRow({ txn }: { txn: Transaction }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.narration} numberOfLines={2}>{txn.narration}</Text>
        <Text style={styles.date}>{txn.txn_date}</Text>
      </View>
      <Text style={[styles.amount, { color: txn.direction === 'debit' ? '#EF4444' : '#22C55E' }]}>
        {txn.direction === 'debit' ? '-' : '+'}{formatINR(txn.amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  navBtn: { padding: 8 },
  navArrow: { fontSize: 22, color: '#1A3C5E', fontWeight: '700' },
  monthText: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  search: {
    margin: 12, padding: 10, backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB', fontSize: 14, color: '#1F2937',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#9CA3AF', fontSize: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#fff',
    marginHorizontal: 12, marginBottom: 1, borderRadius: 8,
  },
  narration: { fontSize: 13, color: '#374151' },
  date: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700' },
});
