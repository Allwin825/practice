import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getDb } from '../../src/db';
import { getBudgetActualsForMonth, getTotalSpendForMonth } from '../../src/db/queries';
import { BudgetActual } from '../../src/types';

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

export default function BudgetScreen() {
  const [month, setMonth] = useState(currentMonth);
  const [actuals, setActuals] = useState<BudgetActual[]>([]);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [month]);

  async function loadData() {
    setLoading(true);
    try {
      const db = await getDb();
      const [budgetActuals, totals] = await Promise.all([
        getBudgetActualsForMonth(db, month),
        getTotalSpendForMonth(db, month),
      ]);
      setActuals(budgetActuals);
      setTotalDebit(totals.total_debit ?? 0);
      setTotalCredit(totals.total_credit ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const savings = totalCredit - totalDebit;
  const today = new Date().getDate();
  const daysInMonth = new Date(
    parseInt(month.split('-')[0]),
    parseInt(month.split('-')[1]),
    0
  ).getDate();
  const daysElapsed = Math.min(today, daysInMonth);
  const projectedSpend =
    daysElapsed > 0 ? (totalDebit / daysElapsed) * daysInMonth : totalDebit;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setMonth(prevMonth(month))} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthText}>{month}</Text>
        <TouchableOpacity onPress={() => setMonth(nextMonth(month))} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Spent</Text>
          <Text style={[styles.summaryValue, { color: '#EF4444' }]}>{formatINR(totalDebit)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Income</Text>
          <Text style={[styles.summaryValue, { color: '#22C55E' }]}>{formatINR(totalCredit)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Net Savings</Text>
          <Text style={[styles.summaryValue, { color: savings >= 0 ? '#3B82F6' : '#F97316' }]}>
            {formatINR(savings)}
          </Text>
        </View>
        <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.summaryLabel}>Projected Month-end Spend</Text>
          <Text style={[styles.summaryValue, { color: '#6366F1' }]}>{formatINR(projectedSpend)}</Text>
        </View>
      </View>

      {loading ? (
        <Text style={styles.muted}>Loading...</Text>
      ) : actuals.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No budgets set</Text>
          <Text style={styles.muted}>
            Budget planning will be available after you import transactions.
            You'll be able to set per-category limits and track progress here.
          </Text>
        </View>
      ) : (
        actuals.map((a) => <BudgetBar key={String(a.category_id ?? 'total')} item={a} />)
      )}
    </ScrollView>
  );
}

function BudgetBar({ item }: { item: BudgetActual }) {
  const pct =
    item.planned_amount > 0
      ? Math.min((item.actual_amount / item.planned_amount) * 100, 100)
      : 0;
  const over = item.actual_amount > item.planned_amount;

  return (
    <View style={styles.budgetBar}>
      <View style={styles.budgetLabelRow}>
        <Text style={styles.budgetCat}>{item.category_name}</Text>
        <Text style={[styles.budgetAmt, { color: over ? '#EF4444' : '#374151' }]}>
          {formatINR(item.actual_amount)} / {formatINR(item.planned_amount)}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${pct}%`, backgroundColor: over ? '#EF4444' : '#3B82F6' },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingBottom: 32 },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  navBtn: { padding: 8 },
  navArrow: { fontSize: 22, color: '#1A3C5E', fontWeight: '700' },
  monthText: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  summaryCard: { margin: 12, backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  summaryLabel: { color: '#6B7280', fontSize: 14 },
  summaryValue: { fontWeight: '700', fontSize: 14 },
  muted: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', margin: 16 },
  emptyCard: { margin: 12, backgroundColor: '#fff', borderRadius: 12, padding: 20, elevation: 1 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  budgetBar: { marginHorizontal: 12, marginBottom: 10, backgroundColor: '#fff', borderRadius: 10, padding: 14, elevation: 1 },
  budgetLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  budgetCat: { fontSize: 14, fontWeight: '600', color: '#374151' },
  budgetAmt: { fontSize: 13 },
  barTrack: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
});
