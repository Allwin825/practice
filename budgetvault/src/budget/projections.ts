export interface Projection {
  projectedSpend: number;
  overspendAmount: number;
  percentElapsed: number;
  daysRemaining: number;
  dailyBudget: number;
  onTrack: boolean;
}

export function computeProjection(
  plannedAmount: number,
  actualSpent: number,
  month: string
): Projection {
  const now = new Date();
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const isCurrentMonth = now.getFullYear() === y && now.getMonth() + 1 === m;
  const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth;
  const daysRemaining = isCurrentMonth ? daysInMonth - daysElapsed : 0;

  const dailyBurn = daysElapsed > 0 ? actualSpent / daysElapsed : 0;
  const projectedSpend = dailyBurn * daysInMonth;
  const overspendAmount = projectedSpend - plannedAmount;
  const percentElapsed = (daysElapsed / daysInMonth) * 100;
  const dailyBudget = plannedAmount / daysInMonth;

  return {
    projectedSpend,
    overspendAmount,
    percentElapsed,
    daysRemaining,
    dailyBudget,
    onTrack: projectedSpend <= plannedAmount * 1.05,
  };
}

export interface Suggestion {
  type: 'overspend' | 'savings' | 'uncategorized' | 'on_track';
  message: string;
  categoryName?: string;
}

export function generateSuggestions(
  budgetActuals: Array<{
    category_name: string;
    planned_amount: number;
    actual_amount: number;
  }>,
  savingsRate: number,
  uncategorizedCount: number,
  month: string
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (uncategorizedCount > 0) {
    suggestions.push({
      type: 'uncategorized',
      message: `${uncategorizedCount} transaction${uncategorizedCount !== 1 ? 's' : ''} need categorization — totals may be off.`,
    });
  }

  for (const ba of budgetActuals) {
    if (ba.planned_amount > 0) {
      const proj = computeProjection(ba.planned_amount, ba.actual_amount, month);
      if (!proj.onTrack && proj.overspendAmount > 100) {
        suggestions.push({
          type: 'overspend',
          categoryName: ba.category_name,
          message: `${ba.category_name} on pace to exceed budget by ₹${Math.round(proj.overspendAmount).toLocaleString('en-IN')}.`,
        });
      }
    }
  }

  if (savingsRate > 0 && savingsRate < 20) {
    suggestions.push({
      type: 'savings',
      message: `Savings rate ${savingsRate.toFixed(1)}% — target 20%+. Review discretionary spending.`,
    });
  }

  if (suggestions.length === 0 && savingsRate > 0) {
    suggestions.push({
      type: 'on_track',
      message: `On track! Savings rate: ${savingsRate.toFixed(1)}%. Keep it up.`,
    });
  }

  return suggestions;
}
