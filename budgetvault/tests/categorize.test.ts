import { categorize } from '../src/categorize/engine';
import { CategoryRule } from '../src/types';

const RULES: CategoryRule[] = [
  { id: 1, pattern: 'SWIGGY',    category_id: 10, priority: 10, source: 'seed' },
  { id: 2, pattern: 'ZOMATO',    category_id: 10, priority: 10, source: 'seed' },
  { id: 3, pattern: 'ATM WDL',   category_id: 20, priority: 10, source: 'seed' },
  { id: 4, pattern: 'SALARY',    category_id: 30, priority: 10, source: 'seed' },
  { id: 5, pattern: 'BIGBASKET', category_id: 40, priority: 10, source: 'learned' },
];

describe('categorize', () => {
  test('matches SWIGGY narration to Food', () => {
    const { categoryId, source } = categorize('UPI-SWIGGY INDIA PVT LTD', RULES);
    expect(categoryId).toBe(10);
    expect(source).toBe('rule');
  });

  test('case insensitive', () => {
    const { categoryId } = categorize('zomato online food', RULES);
    expect(categoryId).toBe(10);
  });

  test('returns uncategorized when no rule matches', () => {
    const { categoryId, source } = categorize('RANDOM MERCHANT XYZ', RULES);
    expect(categoryId).toBeNull();
    expect(source).toBe('uncategorized');
  });

  test('learned rule source maps to learned', () => {
    const { source } = categorize('BIGBASKET PURCHASE', RULES);
    expect(source).toBe('learned');
  });

  test('ATM withdrawal categorized', () => {
    const { categoryId } = categorize('ATM WDL 123456', RULES);
    expect(categoryId).toBe(20);
  });
});
