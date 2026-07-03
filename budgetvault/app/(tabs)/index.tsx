import { useCallback, useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getDb } from '../../src/db';
import {
  get6MonthTrend,
  getBudgetActualsForMonth,
  getMonthlySpendByCategory,
  getTotalSpendForMonth,
  getUncategorizedCount,
} from '../../src/db/queries';
import { DonutChart } from '../components/DonutChart';
import { TrendChart, TrendPoint } from '../components/TrendChart';
import type { BudgetActual, MonthlySpend } from '../../src/types';

const { width: SCREEN_W } = Dimensions.get('window');

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function fmt(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export default function DashboardScreen() {
  const [month] = useState(currentMonth);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [categorySpend, setCategorySpend] = useState<MonthlySpend[]>([]);
  const [budgetActuals, setBudgetActuals] = useState<BudgetActual[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [uncategorized, setUncategorized] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const db = await getDb();
      const [totals, cats, budgets, trendData, unc] = await Promise.all([
        getTotalSpendForMonth(db, month),
        getMonthlySpendByCategory(db, month),
        getBudgetActualsForMonth(db, month),
        get6MonthTrend(db),
        getUncategorizedCount(db),
      ]);
      setTotalDebit(totals.total_debit ?? 0);
      setTotalCredit(totals.total_credit ?? 0);
      setCategorySpend(cats);
      setBudgetActuals(budgets);
      setTrend(trendData);
      setUncategorized(unc);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const savings = totalCredit - totalDebit;
  const savingsRate = totalCredit > 0 ? (savings / totalCredit) * 100 : 0;
  const totalBudgeted = budgetActuals.reduce((s, b) => s + b.planned_amount, 0);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.monthLabel}>{month}</Text>

      {/* Donut + stats row */}
      <View style={s.heroCard}>
        <DonutChart
          spent={totalDebit}
          total={totalBudgeted > 0 ? totalBudgeted : totalCredit || 1}
          size={148}
          centerLabel={fmt(totalDebit)}
          centerSub="spent"
        />
        <View style={s.heroStats}>
          <StatLine label="Income" value={fmt(totalCredit)} color="#22C55E" />
          <StatLine label="Spent" value={fmt(totalDebit)} color="#EF4444" />
          <StatLine
            label="Saved"
            value={fmt(savings)}
            color={savings >= 0 ? '#3B82F6' : '#F97316'}
          />
          <StatLine
            label="Rate"
            value={`${savingsRate.toFixed(1)}%`}
            color={savingsRate >= 20 ? '#22C55E' : savingsRate >= 10 ? '#EAB308' : '#EF4444'}
          />
          {totalBudgeted > 0 && (
            <StatLine
              label="Budget"
              value={fmt(totalBudgeted)}
              color="#6B7280"
            />
          )}
        </View>
      </View>

      {/* Uncategorized alert */}
      {uncategorized > 0 && (
        <View style={s.warnCard}>
          <Text style={s.warnText}>
            ⚠ {uncategorized} transaction{uncategorized !== 1 ? 's' : ''} need categorization
          </Text>
        </View>
      )}

      {/* 6-month trend */}
      <View style={s.card}>
        <Text style={s.cardTitle}>6-Month Spend Trend</Text>
        {loading ? (
          <Text style={s.muted}>Loading...</Text>
        ) : (
          <TrendChart
            data={trend}
            currentMonth={month}
            width={SCREEN_W - 64}
            height={100}
          />
        )}
      </View>

      {/* Top categories */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Top Spending — {month}</Text>
        {loading ? (
          <Text style={s.muted}>Loading...</Text>
        ) : categorySpend.length === 0 ? (
          <Text style={s.muted}>No transactions yet. Import a statement to get started.</Text>
        ) : (
          <>
            {categorySpend.slice(0, 6).map((c) => {
              const pct = totalDebit > 0 ? (c.spent / totalDebit) * 100 : 0;
              return (
                <View key={c.category_name ?? 'unc'} style={s.catRow}>
                  <View style={{ flex: 1 }}>
                    <View style={s.catLabelRow}>
                      <Text style={s.catName}>{c.category_name ?? 'Uncategorized'}</Text>
                      <Text style={s.catAmount}>{fmt(c.spent)}</Text>
                    </View>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </View>

      {/* Budget snapshot */}
      {budgetActuals.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Budget Snapshot</Text>
          {budgetActuals.slice(0, 4).map((b) => {
            const pct = b.planned_amount > 0
              ? Math.min((b.actual_amount / b.planned_amount) * 100, 100)
              : 0;
            const over = b.actual_amount > b.planned_amount;
            return (
              <View key={String(b.category_id ?? 'inc')} style={s.budgetRow}>
                <View style={s.catLabelRow}>
                  <Text style={s.catName}>{b.category_name}</Text>
                  <Text style={[s.catAmount, { color: over ? '#EF4444' : '#374151' }]}>
                    {fmt(b.actual_amount)} / {fmt(b.planned_amount)}
                  </Text>
                </View>
                <View style={s.barTrack}>
                  <View
                    style={[s.barFill, {
                      width: `${pct}%`,
                      backgroundColor: over ? '#EF4444' : '#1A3C5E',
                    }]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function StatLine({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.statLine}>
      <Text style={s.statLineLabel}>{label}</Text>
      <Text style={[s.statLineValue, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 36 },
  monthLabel: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  heroCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    marginBottom: 12, elevation: 1,
  },
  heroStats: { flex: 1, gap: 6 },
  statLine: { flexDirection: 'row', justifyContent: 'space-between' },
  statLineLabel: { fontSize: 13, color: '#6B7280' },
  statLineValue: { fontSize: 13, fontWeight: '700' },
  warnCard: {
    backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#F59E0B',
  },
  warnText: { color: '#92400E', fontWeight: '600', fontSize: 13 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 12, elevation: 1,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  muted: { color: '#9CA3AF', fontSize: 13 },
  catRow: { marginBottom: 10 },
  budgetRow: { marginBottom: 10 },
  catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catName: { fontSize: 13, color: '#374151' },
  catAmount: { fontSize: 13, fontWeight: '600', color: '#EF4444' },
  barTrack: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: '#1A3C5E', borderRadius: 3 },
});
