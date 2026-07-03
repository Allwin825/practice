import { computeProjection, generateSuggestions } from '../src/budget/projections';

// Use a fixed past month so tests are date-independent.
// All amounts are in paise (integer, 100 paise = ₹1).
const PAST_MONTH = '2024-01';

describe('computeProjection', () => {
  it('returns full-month values for a past month', () => {
    const result = computeProjection(1000000, 800000, PAST_MONTH);
    expect(result.daysRemaining).toBe(0);
    expect(result.percentElapsed).toBe(100);
    expect(result.projectedSpend).toBe(800000);
    expect(result.dailyBudget).toBeCloseTo(1000000 / 31, 2);
  });

  it('marks on track when projected spend is within 105% of plan', () => {
    const result = computeProjection(1000000, 500000, PAST_MONTH);
    expect(result.onTrack).toBe(true);
  });

  it('marks off track when projected spend exceeds 105% of plan', () => {
    // spent 1200000 paise (₹12000) in a full past month → projectedSpend > 1050000
    const result = computeProjection(1000000, 1200000, PAST_MONTH);
    expect(result.onTrack).toBe(false);
    expect(result.overspendAmount).toBeCloseTo(200000, 0);
  });

  it('returns zero projectedSpend when nothing spent', () => {
    const result = computeProjection(1000000, 0, PAST_MONTH);
    expect(result.projectedSpend).toBe(0);
    expect(result.onTrack).toBe(true);
  });

  it('computes correct daysInMonth for February (non-leap)', () => {
    const result = computeProjection(280000, 280000, '2023-02');
    expect(result.percentElapsed).toBe(100);
    expect(result.dailyBudget).toBeCloseTo(280000 / 28, 2);
  });

  it('computes correct daysInMonth for February (leap year)', () => {
    const result = computeProjection(290000, 290000, '2024-02');
    expect(result.percentElapsed).toBe(100);
    expect(result.dailyBudget).toBeCloseTo(290000 / 29, 2);
  });
});

describe('generateSuggestions', () => {
  const goodActuals = [
    { category_name: 'Food', planned_amount: 500000, actual_amount: 400000 },
  ];

  it('returns on_track suggestion when everything is fine', () => {
    const suggestions = generateSuggestions(goodActuals, 25, 0, PAST_MONTH);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].type).toBe('on_track');
  });

  it('returns uncategorized warning when uncategorizedCount > 0', () => {
    const suggestions = generateSuggestions(goodActuals, 25, 3, PAST_MONTH);
    expect(suggestions.some(s => s.type === 'uncategorized')).toBe(true);
  });

  it('returns overspend warning when a category is off track by >₹100', () => {
    const overspentActuals = [
      // Dining: planned ₹3000 (300000p), actual ₹5000 (500000p) → overspend ₹2000 > ₹100
      { category_name: 'Dining', planned_amount: 300000, actual_amount: 500000 },
    ];
    const suggestions = generateSuggestions(overspentActuals, 25, 0, PAST_MONTH);
    expect(suggestions.some(s => s.type === 'overspend' && s.categoryName === 'Dining')).toBe(true);
  });

  it('returns savings warning when savings rate < 20%', () => {
    const suggestions = generateSuggestions(goodActuals, 10, 0, PAST_MONTH);
    expect(suggestions.some(s => s.type === 'savings')).toBe(true);
  });

  it('does not return savings warning when savings rate is 0', () => {
    const suggestions = generateSuggestions([], 0, 0, PAST_MONTH);
    expect(suggestions.every(s => s.type !== 'savings')).toBe(true);
  });

  it('skips overspend suggestion when overspend is <= ₹100', () => {
    const marginalActuals = [
      // Food: planned ₹3000 (300000p), actual ₹3050 (305000p) → overspend ₹50 ≤ ₹100
      { category_name: 'Food', planned_amount: 300000, actual_amount: 305000 },
    ];
    const suggestions = generateSuggestions(marginalActuals, 25, 0, PAST_MONTH);
    expect(suggestions.every(s => s.type !== 'overspend')).toBe(true);
  });

  it('skips overspend for categories with no planned budget', () => {
    const unplanned = [
      { category_name: 'Misc', planned_amount: 0, actual_amount: 999900 },
    ];
    const suggestions = generateSuggestions(unplanned, 25, 0, PAST_MONTH);
    expect(suggestions.every(s => s.type !== 'overspend')).toBe(true);
  });

  it('can return multiple suggestions at once', () => {
    const mixed = [
      { category_name: 'Food', planned_amount: 300000, actual_amount: 600000 },
    ];
    const suggestions = generateSuggestions(mixed, 10, 2, PAST_MONTH);
    const types = suggestions.map(s => s.type);
    expect(types).toContain('uncategorized');
    expect(types).toContain('overspend');
    expect(types).toContain('savings');
  });
});
