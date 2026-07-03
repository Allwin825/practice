import { categorize, invalidateRulesCache } from '../src/categorize/engine';
import { CategoryRule } from '../src/types';

function rule(id: number, pattern: string, categoryId: number, priority = 10, source: 'seed' | 'user' | 'learned' = 'seed'): CategoryRule {
  return { id, pattern, category_id: categoryId, priority, source };
}

beforeEach(() => {
  invalidateRulesCache();
});

describe('categorize', () => {
  it('returns uncategorized when no rules exist', () => {
    const result = categorize('SWIGGY ORDER 123', []);
    expect(result.categoryId).toBeNull();
    expect(result.source).toBe('uncategorized');
  });

  it('matches a rule case-insensitively', () => {
    const rules = [rule(1, 'swiggy', 5)];
    const result = categorize('SWIGGY ORDER 123', rules);
    expect(result.categoryId).toBe(5);
    expect(result.source).toBe('rule');
  });

  it('marks source as learned for learned rules', () => {
    const rules = [rule(1, 'amazon', 3, 10, 'learned')];
    const result = categorize('AMAZON PURCHASE', rules);
    expect(result.source).toBe('learned');
  });

  it('marks source as rule for seed rules', () => {
    const rules = [rule(1, 'zomato', 5, 10, 'seed')];
    const result = categorize('ZOMATO FOOD', rules);
    expect(result.source).toBe('rule');
  });

  it('marks source as rule for user rules', () => {
    const rules = [rule(1, 'netflix', 7, 10, 'user')];
    const result = categorize('NETFLIX SUBSCRIPTION', rules);
    expect(result.source).toBe('rule');
  });

  it('matches the first rule in list order (priority already sorted by caller)', () => {
    const rules = [
      rule(1, 'amazon', 3, 10),
      rule(2, 'amazon prime', 7, 20),
    ];
    // First rule wins since engine iterates in order
    const result = categorize('AMAZON PRIME VIDEO', rules);
    expect(result.categoryId).toBe(3);
  });

  it('returns uncategorized when no pattern matches', () => {
    const rules = [rule(1, 'zomato', 5)];
    const result = categorize('UPI TRANSFER TO FRIEND', rules);
    expect(result.categoryId).toBeNull();
    expect(result.source).toBe('uncategorized');
  });

  it('matches a partial substring within the narration', () => {
    const rules = [rule(1, 'fuel', 8)];
    const result = categorize('HP FUEL STATION MUMBAI', rules);
    expect(result.categoryId).toBe(8);
  });

  it('is case-insensitive for both narration and pattern', () => {
    const rules = [rule(1, 'NETFLIX', 7)];
    const result = categorize('netflix subscription monthly', rules);
    expect(result.categoryId).toBe(7);
  });

  it('skips non-matching rules and matches the correct one', () => {
    const rules = [
      rule(1, 'swiggy', 5),
      rule(2, 'electricity', 9),
    ];
    const result = categorize('TATA POWER ELECTRICITY BILL', rules);
    expect(result.categoryId).toBe(9);
  });
});
