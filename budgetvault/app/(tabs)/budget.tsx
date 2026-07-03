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
  getBudgetsForMonth,
  getCategories,
  getTotalSpendForMonth,
  getUncategorizedCount,
  copyBudgetsFromMonth,
  upsertBudget,
} from '../../src/db/queries';
import { computeProjection, generateSuggestions } from '../../src/budget/projections';
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
  const [month, setMonth] = useState(currentMonth);
  const [actuals, setActuals] = useState<BudgetActual[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [uncategorized, setUncategorized] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editValue, setEditValue] = useState('');
  const [addCatVisible, setAddCatVisible] = useState(false);

  useEffect(() => { loadData(); }, [month]);

  async function loadData() {
    setLoading(true);
    try {
      const db = await getDb();
      const [budgetActuals, totals, cats, unc] = await Promise.all([
        getBudgetActualsForMonth(db, month),
        getTotalSpendForMonth(db, month),
        getCategories(db),
        getUncategorizedCount(db),
      ]);
      setActuals(budgetActuals);
      setTotalDebit(totals.total_debit ?? 0);
      setTotalCredit(totals.total_credit ?? 0);
      setCategories(cats);
      setUncategorized(unc);
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
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={s.container} contentContainerStyle={s.content}>
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

        {/* Summary card */}
        <View style={s.summaryCard}>
          <SummaryRow label="Income (actual)" value={fmt(totalCredit)} color="#22C55E" />
          <SummaryRow label="Spent" value={fmt(totalDebit)} color="#EF4444" />
          <SummaryRow
            label="Savings"
            value={`${fmt(savings)} (${savingsRate.toFixed(1)}%)`}
            color={savings >= 0 ? '#3B82F6' : '#F97316'}
          />
          {totalBudgeted > 0 && (
            <SummaryRow label="Total budgeted" value={fmt(totalBudgeted)} color="#6B7280" />
          )}
          {isCurrentMonth && daysElapsed > 0 && (
            <SummaryRow
              label={`Projected (${daysRemaining}d left)`}
              value={fmt(projectedTotal)}
              color={projectedTotal > totalBudgeted && totalBudgeted > 0 ? '#EF4444' : '#6366F1'}
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
          <Text style={s.muted}>Loading...</Text>
        ) : actuals.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>No budgets set for {month}</Text>
            <Text style={s.muted}>
              Tap "Copy from {prevMonth(month)}" to bring in last month's budgets, or tap "+ Add category" to set one.
            </Text>
          </View>
        ) : (
          <>
            {/* Income budget row */}
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
                />
              ))}

            {/* Expense budget rows */}
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
                />
              ))}
          </>
        )}

        {/* Suggestions */}
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
      </ScrollView>

      {/* Edit budget modal */}
      {editTarget && (
        <Modal visible animationType="slide" transparent>
          <TouchableOpacity
            style={s.modalOverlay}
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
                placeholderTextColor="#9CA3AF"
                autoFocus
                selectTextOnFocus
              />
              <Text style={s.editHint}>Enter monthly budget amount (₹)</Text>
              <View style={s.editActions}>
                <TouchableOpacity
                  style={[s.btn, s.btnSecondary]}
                  onPress={() => setEditTarget(null)}
                >
                  <Text style={[s.btnText, { color: '#374151' }]}>Cancel</Text>
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
          <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setAddCatVisible(false)} />
          <View style={s.addCatSheet}>
            <View style={s.editSheetHeader}>
              <Text style={s.editTitle}>Add Category Budget</Text>
              <TouchableOpacity onPress={() => setAddCatVisible(false)}>
                <Text style={s.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {unbudgetedExpenseCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={s.catOption}
                  onPress={() => addCategoryBudget(cat.id, cat.name)}
                >
                  <View style={[s.catDot, { backgroundColor: cat.color ?? '#9CA3AF' }]} />
                  <Text style={s.catOptionText}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function BudgetRow({
  label, planned, actual, isIncome, onEdit, month,
}: {
  label: string;
  planned: number;
  actual: number;
  isIncome?: boolean;
  onEdit: () => void;
  month: string;
}) {
  const pct = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
  const over = actual > planned && planned > 0;
  const proj = planned > 0 ? computeProjection(planned, actual, month) : null;

  return (
    <TouchableOpacity style={s.budgetRow} onPress={onEdit} activeOpacity={0.7}>
      <View style={s.budgetLabelRow}>
        <Text style={s.budgetCatName}>{label}</Text>
        <TouchableOpacity onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.editChip}>
            {planned > 0 ? `${fmt(actual)} / ${fmt(planned)}` : `${fmt(actual)} — tap to set`}
          </Text>
        </TouchableOpacity>
      </View>
      {planned > 0 && (
        <View style={s.barTrack}>
          <View
            style={[
              s.barFill,
              {
                width: `${pct}%`,
                backgroundColor: isIncome
                  ? '#22C55E'
                  : over ? '#EF4444' : pct > 85 ? '#F97316' : '#1A3C5E',
              },
            ]}
          />
        </View>
      )}
      {proj && !proj.onTrack && !isIncome && (
        <Text style={s.projText}>
          Projected: {fmt(proj.projectedSpend)} (+{fmt(proj.overspendAmount)} over)
        </Text>
      )}
    </TouchableOpacity>
  );
}

function SummaryRow({
  label, value, color, last,
}: { label: string; value: string; color: string; last?: boolean }) {
  return (
    <View style={[s.summaryRow, last && { borderBottomWidth: 0 }]}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={[s.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingBottom: 40 },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  navBtn: { padding: 8 },
  navArrow: { fontSize: 22, color: '#1A3C5E', fontWeight: '700' },
  monthText: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  summaryCard: { margin: 12, backgroundColor: '#fff', borderRadius: 14, padding: 16, elevation: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  summaryLabel: { color: '#6B7280', fontSize: 14 },
  summaryValue: { fontWeight: '700', fontSize: 14 },
  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  actionBtn: { flex: 1, backgroundColor: '#EFF6FF', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  actionBtnText: { color: '#1A3C5E', fontWeight: '700', fontSize: 13 },
  muted: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', margin: 16 },
  emptyCard: { margin: 12, backgroundColor: '#fff', borderRadius: 14, padding: 20, elevation: 1 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  budgetRow: {
    marginHorizontal: 12, marginBottom: 8, backgroundColor: '#fff',
    borderRadius: 12, padding: 14, elevation: 1,
  },
  budgetLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  budgetCatName: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  editChip: { fontSize: 13, color: '#1A3C5E' },
  barTrack: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  projText: { fontSize: 11, color: '#EF4444', marginTop: 4 },
  suggestCard: { margin: 12, backgroundColor: '#fff', borderRadius: 14, padding: 16, elevation: 1 },
  suggestTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  suggestRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  suggestIcon: { fontSize: 16 },
  suggestText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  // Edit modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  editSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  editSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  editTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  editMonth: { fontSize: 13, color: '#9CA3AF', marginBottom: 16 },
  closeBtn: { fontSize: 18, color: '#9CA3AF', padding: 4 },
  amountInput: {
    borderWidth: 2, borderColor: '#1A3C5E', borderRadius: 12,
    padding: 16, fontSize: 28, fontWeight: '700', color: '#1F2937',
    textAlign: 'center', marginBottom: 6,
  },
  editHint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 20 },
  editActions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, backgroundColor: '#1A3C5E', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnSecondary: { backgroundColor: '#E5E7EB' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  // Add category modal
  addCatSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 40, maxHeight: '60%',
  },
  catOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  catOptionText: { fontSize: 15, color: '#374151' },
  catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
});
