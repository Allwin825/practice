import { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getDb } from '../../src/db';
import {
  getBudgetActualsForMonth,
  getCategories,
  getTotalSpendForMonth,
  getUncategorizedCount,
  copyBudgetsFromMonth,
  detectRecurring,
  upsertBudget,
  type RecurringItem,
} from '../../src/db/queries';
import { computeProjection, generateSuggestions } from '../../src/budget/projections';
import { useTheme } from '../../src/theme/ThemeContext';
import type { ColorTokens } from '../../src/theme/tokens';
import type { BudgetActual, Category } from '../../src/types';

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

function fmt(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

interface EditTarget {
  categoryId: number | null;
  categoryName: string;
  current: number;
}

export default function BudgetScreen() {
  const { colors } = useTheme();
  const [month, setMonth] = useState(currentMonth);
  const [actuals, setActuals] = useState<BudgetActual[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [uncategorized, setUncategorized] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editValue, setEditValue] = useState('');
  const [addCatVisible, setAddCatVisible] = useState(false);

  useEffect(() => { loadData(); }, [month]);

  async function loadData() {
    setLoading(true);
    try {
      const db = await getDb();
      const [budgetActuals, totals, cats, unc, rec] = await Promise.all([
        getBudgetActualsForMonth(db, month),
        getTotalSpendForMonth(db, month),
        getCategories(db),
        getUncategorizedCount(db),
        detectRecurring(db),
      ]);
      setActuals(budgetActuals);
      setTotalDebit(totals.total_debit ?? 0);
      setTotalCredit(totals.total_credit ?? 0);
      setCategories(cats);
      setUncategorized(unc);
      setRecurring(rec);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function copyFromLastMonth() {
    try {
      const db = await getDb();
      const from = prevMonth(month);
      await copyBudgetsFromMonth(db, from, month);
      await loadData();
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  }

  function openEdit(categoryId: number | null, categoryName: string, current: number) {
    setEditTarget({ categoryId, categoryName, current });
    setEditValue(current > 0 ? String(Math.round(current)) : '');
  }

  async function saveEdit() {
    if (!editTarget) return;
    const amount = parseFloat(editValue.replace(/,/g, '')) || 0;
    if (amount < 0) { Alert.alert('Invalid amount'); return; }
    try {
      const db = await getDb();
      await upsertBudget(db, month, editTarget.categoryId, amount);
      setEditTarget(null);
      await loadData();
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  }

  async function addCategoryBudget(categoryId: number, categoryName: string) {
    setAddCatVisible(false);
    openEdit(categoryId, categoryName, 0);
  }

  const savings = totalCredit - totalDebit;
  const savingsRate = totalCredit > 0 ? (savings / totalCredit) * 100 : 0;
  const totalBudgeted = actuals.reduce((s, b) => s + b.planned_amount, 0);

  const today = new Date();
  const [y, mo] = month.split('-').map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === mo;
  const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;
  const daysRemaining = isCurrentMonth ? daysInMonth - daysElapsed : 0;
  const dailyBurn = daysElapsed > 0 ? totalDebit / daysElapsed : 0;
  const projectedTotal = dailyBurn * daysInMonth;

  const suggestions = generateSuggestions(
    actuals.map((a) => ({
      category_name: a.category_name,
      planned_amount: a.planned_amount,
      actual_amount: a.actual_amount,
    })),
    savingsRate,
    uncategorized,
    month
  );

  const budgetedCategoryIds = new Set(actuals.map((a) => a.category_id));
  const unbudgetedExpenseCategories = categories.filter(
    (c) => c.kind === 'expense' && !budgetedCategoryIds.has(c.id)
  );

  const s = makeStyles(colors);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <View style={s.monthNav}>
          <TouchableOpacity onPress={() => setMonth(prevMonth(month))} style={s.navBtn} accessibilityLabel="Previous month" accessibilityRole="button">
            <Text style={s.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.monthText} accessibilityLabel={`Month: ${month}`}>{month}</Text>
          <TouchableOpacity onPress={() => setMonth(nextMonth(month))} style={s.navBtn} accessibilityLabel="Next month" accessibilityRole="button">
            <Text style={s.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Summary card */}
        <View style={s.summaryCard}>
          <SummaryRow label="Income (actual)" value={fmt(totalCredit)} color={colors.success} colors={colors} />
          <SummaryRow label="Spent" value={fmt(totalDebit)} color={colors.danger} colors={colors} />
          <SummaryRow
            label="Savings"
            value={`${fmt(savings)} (${savingsRate.toFixed(1)}%)`}
            color={savings >= 0 ? '#3B82F6' : '#F97316'}
            colors={colors}
          />
          {totalBudgeted > 0 && (
            <SummaryRow label="Total budgeted" value={fmt(totalBudgeted)} color={colors.textMuted} colors={colors} />
          )}
          {isCurrentMonth && daysElapsed > 0 && (
            <SummaryRow
              label={`Projected (${daysRemaining}d left)`}
              value={fmt(projectedTotal)}
              color={projectedTotal > totalBudgeted && totalBudgeted > 0 ? colors.danger : '#6366F1'}
              colors={colors}
              last
            />
          )}
        </View>

        {/* Actions */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.actionBtn} onPress={copyFromLastMonth}>
            <Text style={s.actionBtnText}>Copy from {prevMonth(month)}</Text>
          </TouchableOpacity>
          {unbudgetedExpenseCategories.length > 0 && (
            <TouchableOpacity style={s.actionBtn} onPress={() => setAddCatVisible(true)}>
              <Text style={s.actionBtnText}>+ Add category</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Budget rows */}
        {loading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={{ marginHorizontal: 12, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 12, padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View style={{ height: 14, backgroundColor: colors.surfaceAlt, borderRadius: 4, width: '45%' }} />
                  <View style={{ height: 14, backgroundColor: colors.surfaceAlt, borderRadius: 4, width: '30%' }} />
                </View>
                <View style={{ height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4 }} />
              </View>
            ))}
          </>
        ) : actuals.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>No budgets set for {month}</Text>
            <Text style={s.muted}>
              Tap "Copy from {prevMonth(month)}" to bring in last month's budgets, or tap "+ Add category" to set one.
            </Text>
          </View>
        ) : (
          <>
            {actuals
              .filter((a) => a.category_id === null)
              .map((a) => (
                <BudgetRow
                  key="income"
                  label={a.category_name}
                  planned={a.planned_amount}
                  actual={a.actual_amount}
                  isIncome
                  onEdit={() => openEdit(null, 'Income target', a.planned_amount)}
                  month={month}
                  colors={colors}
                />
              ))}
            {actuals
              .filter((a) => a.category_id !== null)
              .map((a) => (
                <BudgetRow
                  key={String(a.category_id)}
                  label={a.category_name}
                  planned={a.planned_amount}
                  actual={a.actual_amount}
                  onEdit={() => openEdit(a.category_id, a.category_name, a.planned_amount)}
                  month={month}
                  colors={colors}
                />
              ))}
          </>
        )}

        {/* Insights */}
        {suggestions.length > 0 && (
          <View style={s.suggestCard}>
            <Text style={s.suggestTitle}>Insights</Text>
            {suggestions.map((sg, i) => (
              <View key={i} style={s.suggestRow}>
                <Text style={s.suggestIcon}>
                  {sg.type === 'on_track' ? '✅' : sg.type === 'overspend' ? '⚠️' : sg.type === 'savings' ? '💡' : '📋'}
                </Text>
                <Text style={s.suggestText}>{sg.message}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recurring / Subscription Detection */}
        {!loading && recurring.length > 0 && (
          <View style={s.suggestCard}>
            <Text style={s.suggestTitle}>Detected Subscriptions</Text>
            <Text style={[s.muted, { marginBottom: 10, textAlign: 'left' }]}>Merchants that appear in multiple months</Text>
            {recurring.map((r) => (
              <View key={r.merchant} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{r.merchant}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                    {r.txn_count} transactions · {r.month_count} months
                  </Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.danger }}>~{fmt(r.avg_amount)}/mo</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Edit budget modal */}
      {editTarget && (
        <Modal visible animationType="slide" transparent>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
            activeOpacity={1}
            onPress={() => { setEditTarget(null); Keyboard.dismiss(); }}
          />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={s.editSheet}>
              <Text style={s.editTitle}>Budget for {editTarget.categoryName}</Text>
              <Text style={s.editMonth}>{month}</Text>
              <TextInput
                style={s.amountInput}
                value={editValue}
                onChangeText={setEditValue}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                autoFocus
                selectTextOnFocus
              />
              <Text style={s.editHint}>Enter monthly budget amount (₹)</Text>
              <View style={s.editActions}>
                <TouchableOpacity
                  style={[s.btn, s.btnSecondary]}
                  onPress={() => setEditTarget(null)}
                >
                  <Text style={[s.btnText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btn} onPress={saveEdit}>
                  <Text style={s.btnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Add category modal */}
      {addCatVisible && (
        <Modal visible animationType="slide" transparent>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={() => setAddCatVisible(false)} />
          <View style={[s.addCatSheet, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
              <Text style={s.editTitle}>Add Category Budget</Text>
              <TouchableOpacity onPress={() => setAddCatVisible(false)}>
                <Text style={{ fontSize: 18, color: colors.textMuted, padding: 4 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {unbudgetedExpenseCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
                  onPress={() => addCategoryBudget(cat.id, cat.name)}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, marginRight: 10, backgroundColor: cat.color ?? colors.textMuted }} />
                  <Text style={{ fontSize: 15, color: colors.textSecondary }}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
}

function BudgetRow({
  label, planned, actual, isIncome, onEdit, month, colors,
}: {
  label: string;
  planned: number;
  actual: number;
  isIncome?: boolean;
  onEdit: () => void;
  month: string;
  colors: ColorTokens;
}) {
  const pct = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
  const over = actual > planned && planned > 0;
  const proj = planned > 0 ? computeProjection(planned, actual, month) : null;

  return (
    <TouchableOpacity
      style={{
        marginHorizontal: 12, marginBottom: 8, backgroundColor: colors.surface,
        borderRadius: 12, padding: 14, elevation: 1,
      }}
      onPress={onEdit}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{label}</Text>
        <Text style={{ fontSize: 13, color: colors.accent }}>
          {planned > 0 ? `${fmt(actual)} / ${fmt(planned)}` : `${fmt(actual)} — tap to set`}
        </Text>
      </View>
      {planned > 0 && (
        <View style={{ height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
          <View
            style={{
              height: 8, borderRadius: 4,
              width: `${pct}%`,
              backgroundColor: isIncome
                ? colors.success
                : over ? colors.danger : pct > 85 ? '#F97316' : colors.accent,
            }}
          />
        </View>
      )}
      {proj && !proj.onTrack && !isIncome && (
        <Text style={{ fontSize: 11, color: colors.danger, marginTop: 4 }}>
          Projected: {fmt(proj.projectedSpend)} (+{fmt(proj.overspendAmount)} over)
        </Text>
      )}
    </TouchableOpacity>
  );
}

function SummaryRow({
  label, value, color, last, colors,
}: { label: string; value: string; color: string; last?: boolean; colors: ColorTokens }) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.borderLight,
    }}>
      <Text style={{ color: colors.textMuted, fontSize: 14 }}>{label}</Text>
      <Text style={{ fontWeight: '700', fontSize: 14, color }}>{value}</Text>
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { paddingBottom: 40 },
    monthNav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 12, backgroundColor: colors.surface,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    navBtn: { padding: 8 },
    navArrow: { fontSize: 22, color: colors.accent, fontWeight: '700' },
    monthText: { fontSize: 16, fontWeight: '700', color: colors.text },
    summaryCard: { margin: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 16, elevation: 1 },
    actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
    actionBtn: { flex: 1, backgroundColor: colors.accentLight, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
    actionBtnText: { color: colors.accentText, fontWeight: '700', fontSize: 13 },
    muted: { color: colors.textMuted, fontSize: 14, textAlign: 'center', margin: 16 },
    emptyCard: { margin: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 20, elevation: 1 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
    suggestCard: { margin: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 16, elevation: 1 },
    suggestTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
    suggestRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    suggestIcon: { fontSize: 16 },
    suggestText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    editSheet: {
      backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    editTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    editMonth: { fontSize: 13, color: colors.textMuted, marginBottom: 16 },
    amountInput: {
      borderWidth: 2, borderColor: colors.accent, borderRadius: 12,
      padding: 16, fontSize: 28, fontWeight: '700', color: colors.text,
      textAlign: 'center', marginBottom: 6,
    },
    editHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginBottom: 20 },
    editActions: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    btnSecondary: { backgroundColor: colors.surfaceAlt },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    addCatSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: '60%' },
  });
}
