import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getDb } from '../../src/db';
import { getMonthlySpendByCategory, getTotalSpendForMonth, getUncategorizedCount } from '../../src/db/queries';
import { MonthlySpend } from '../../src/types';

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function DashboardScreen() {
  const [month] = useState(currentMonth);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [categorySpend, setCategorySpend] = useState<MonthlySpend[]>([]);
  const [uncategorized, setUncategorized] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [month]);

  async function loadData() {
    try {
      const db = await getDb();
      const [totals, cats, unc] = await Promise.all([
        getTotalSpendForMonth(db, month),
        getMonthlySpendByCategory(db, month),
        getUncategorizedCount(db),
      ]);
      setTotalDebit(totals.total_debit ?? 0);
      setTotalCredit(totals.total_credit ?? 0);
      setCategorySpend(cats);
      setUncategorized(unc);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const savings = totalCredit - totalDebit;
  const savingsRate = totalCredit > 0 ? (savings / totalCredit) * 100 : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.monthLabel}>{month}</Text>

      <View style={styles.row}>
        <StatCard label="Spent" value={formatINR(totalDebit)} accent="#EF4444" />
        <StatCard label="Income" value={formatINR(totalCredit)} accent="#22C55E" />
        <StatCard
          label="Savings"
          value={formatINR(savings)}
          accent={savings >= 0 ? '#3B82F6' : '#F97316'}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Savings Rate</Text>
        <Text style={[styles.bigNumber, { color: savingsRate >= 0 ? '#22C55E' : '#EF4444' }]}>
          {savingsRate.toFixed(1)}%
        </Text>
      </View>

      {uncategorized > 0 && (
        <View style={[styles.card, styles.warnCard]}>
          <Text style={styles.warnText}>
            {uncategorized} transaction{uncategorized !== 1 ? 's' : ''} need categorization
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top Categories</Text>
        {loading ? (
          <Text style={styles.muted}>Loading...</Text>
        ) : categorySpend.length === 0 ? (
          <Text style={styles.muted}>No transactions this month. Import a statement to get started.</Text>
        ) : (
          categorySpend.slice(0, 6).map((c) => (
            <View key={c.category_name} style={styles.catRow}>
              <Text style={styles.catName}>{c.category_name ?? 'Uncategorized'}</Text>
              <Text style={styles.catAmount}>{formatINR(c.spent)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: accent }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 32 },
  monthLabel: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12,
    padding: 12, borderTopWidth: 3, elevation: 1,
  },
  statLabel: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: '700' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, elevation: 1,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  bigNumber: { fontSize: 32, fontWeight: '800' },
  warnCard: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B' },
  warnText: { color: '#92400E', fontWeight: '600' },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  catName: { color: '#374151', fontSize: 14 },
  catAmount: { color: '#EF4444', fontWeight: '600', fontSize: 14 },
  muted: { color: '#9CA3AF', fontSize: 13 },
});
