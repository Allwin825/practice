import { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getDb } from '../../src/db';
import {
  get6MonthTrend,
  getBudgetActualsForMonth,
  getMonthlySpendByCategory,
  getTotalSpendForMonth,
  getUncategorizedCount,
} from '../../src/db/queries';
import { useTheme } from '../../src/theme/ThemeContext';
import { DonutChart } from '../components/DonutChart';
import { TrendChart, TrendPoint } from '../components/TrendChart';
import { formatCurrencyWhole } from '../../src/utils/format';
import type { BudgetActual, MonthlySpend } from '../../src/types';

const { width: SCREEN_W } = Dimensions.get('window');

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const fmt = formatCurrencyWhole;

export default function DashboardScreen() {
  const { colors } = useTheme();
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

  const s = makeStyles(colors);

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
          <StatLine label="Income" value={fmt(totalCredit)} color={colors.success} textColor={colors.text} />
          <StatLine label="Spent" value={fmt(totalDebit)} color={colors.danger} textColor={colors.text} />
          <StatLine
            label="Saved"
            value={fmt(savings)}
            color={savings >= 0 ? '#3B82F6' : '#F97316'}
            textColor={colors.text}
          />
          <StatLine
            label="Rate"
            value={`${savingsRate.toFixed(1)}%`}
            color={savingsRate >= 20 ? colors.success : savingsRate >= 10 ? colors.warning : colors.danger}
            textColor={colors.text}
          />
          {totalBudgeted > 0 && (
            <StatLine label="Budget" value={fmt(totalBudgeted)} color={colors.textMuted} textColor={colors.text} />
          )}
        </View>
      </View>

      {/* Uncategorized alert */}
      {uncategorized > 0 && (
        <View style={[s.warnCard, { backgroundColor: colors.warningBg, borderColor: colors.warning }]}>
          <Text style={[s.warnText, { color: colors.warningText }]}>
            {uncategorized} transaction{uncategorized !== 1 ? 's' : ''} need categorization
          </Text>
        </View>
      )}

      {/* 6-month trend */}
      <View style={s.card}>
        <Text style={s.cardTitle}>6-Month Spend Trend</Text>
        {loading ? (
          <View style={{ height: 100, backgroundColor: colors.surfaceAlt, borderRadius: 8 }} />
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
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={s.catRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <View style={{ height: 12, backgroundColor: colors.surfaceAlt, borderRadius: 4, width: '45%' }} />
                    <View style={{ height: 12, backgroundColor: colors.surfaceAlt, borderRadius: 4, width: '20%' }} />
                  </View>
                  <View style={[s.barTrack, { backgroundColor: colors.surfaceAlt }]} />
                </View>
              </View>
            ))}
          </>
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
                      <Text style={[s.catAmount, { color: colors.danger }]}>{fmt(c.spent)}</Text>
                    </View>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${pct}%`, backgroundColor: colors.accent }]} />
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
                  <Text style={[s.catAmount, { color: over ? colors.danger : colors.textSecondary }]}>
                    {fmt(b.actual_amount)} / {fmt(b.planned_amount)}
                  </Text>
                </View>
                <View style={s.barTrack}>
                  <View
                    style={[s.barFill, {
                      width: `${pct}%`,
                      backgroundColor: over ? colors.danger : colors.accent,
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

function StatLine({ label, value, color, textColor }: { label: string; value: string; color: string; textColor: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13, color: textColor }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color }}>{value}</Text>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import('../../src/theme/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, paddingBottom: 36 },
    monthLabel: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 12 },
    heroCard: {
      backgroundColor: colors.surface, borderRadius: 16, padding: 16,
      flexDirection: 'row', alignItems: 'center', gap: 16,
      marginBottom: 12, elevation: 1,
    },
    heroStats: { flex: 1, gap: 6 },
    warnCard: {
      borderRadius: 10, padding: 12,
      marginBottom: 12, borderWidth: 1,
    },
    warnText: { fontWeight: '600', fontSize: 13 },
    card: {
      backgroundColor: colors.surface, borderRadius: 14, padding: 16,
      marginBottom: 12, elevation: 1,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
    muted: { color: colors.textMuted, fontSize: 13 },
    catRow: { marginBottom: 10 },
    budgetRow: { marginBottom: 10 },
    catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    catName: { fontSize: 13, color: colors.textSecondary },
    catAmount: { fontSize: 13, fontWeight: '600' },
    barTrack: { height: 6, backgroundColor: colors.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
    barFill: { height: 6, borderRadius: 3 },
  });
}
