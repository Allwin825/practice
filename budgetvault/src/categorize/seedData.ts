import { CategoryKind } from '../types';

export interface SeedCategory {
  name: string;
  kind: CategoryKind;
  icon?: string;
  color?: string;
}

export interface SeedRule {
  pattern: string;
  categoryName: string;
  priority?: number;
}

export const SEED_CATEGORIES: SeedCategory[] = [
  // Income
  { name: 'Salary',       kind: 'income',   icon: 'briefcase',     color: '#22C55E' },
  { name: 'Freelance',    kind: 'income',   icon: 'laptop',        color: '#16A34A' },
  { name: 'Interest',     kind: 'income',   icon: 'percent',       color: '#15803D' },
  { name: 'Other Income', kind: 'income',   icon: 'plus-circle',   color: '#166534' },

  // Expense
  { name: 'Food',         kind: 'expense',  icon: 'utensils',      color: '#EF4444' },
  { name: 'Groceries',    kind: 'expense',  icon: 'shopping-basket', color: '#F97316' },
  { name: 'Transport',    kind: 'expense',  icon: 'car',           color: '#3B82F6' },
  { name: 'Fuel',         kind: 'expense',  icon: 'fuel',          color: '#2563EB' },
  { name: 'Utilities',    kind: 'expense',  icon: 'zap',           color: '#A855F7' },
  { name: 'Rent',         kind: 'expense',  icon: 'home',          color: '#8B5CF6' },
  { name: 'Health',       kind: 'expense',  icon: 'heart-pulse',   color: '#EC4899' },
  { name: 'Insurance',    kind: 'expense',  icon: 'shield',        color: '#DB2777' },
  { name: 'Shopping',     kind: 'expense',  icon: 'shopping-bag',  color: '#F59E0B' },
  { name: 'Entertainment',kind: 'expense',  icon: 'tv',            color: '#EAB308' },
  { name: 'Travel',       kind: 'expense',  icon: 'plane',         color: '#06B6D4' },
  { name: 'Education',    kind: 'expense',  icon: 'book-open',     color: '#0EA5E9' },
  { name: 'Subscriptions',kind: 'expense',  icon: 'repeat',        color: '#6366F1' },
  { name: 'Investments',  kind: 'expense',  icon: 'trending-up',   color: '#10B981' },
  { name: 'Cash',         kind: 'expense',  icon: 'banknote',      color: '#6B7280' },
  { name: 'Fees & Charges',kind: 'expense', icon: 'credit-card',   color: '#9CA3AF' },
  { name: 'Uncategorized',kind: 'expense',  icon: 'help-circle',   color: '#D1D5DB' },

  // Transfer
  { name: 'Self Transfer', kind: 'transfer', icon: 'arrow-left-right', color: '#64748B' },
  { name: 'CC Payment',    kind: 'transfer', icon: 'credit-card',      color: '#475569' },
];

export const SEED_RULES: SeedRule[] = [
  // Food
  { pattern: 'SWIGGY',           categoryName: 'Food',         priority: 10 },
  { pattern: 'ZOMATO',           categoryName: 'Food',         priority: 10 },
  { pattern: 'BLINKIT',          categoryName: 'Groceries',    priority: 10 },
  { pattern: 'ZEPTO',            categoryName: 'Groceries',    priority: 10 },
  { pattern: 'BIGBASKET',        categoryName: 'Groceries',    priority: 10 },
  { pattern: 'DUNZO',            categoryName: 'Groceries',    priority: 15 },
  { pattern: 'INSTAMART',        categoryName: 'Groceries',    priority: 10 },
  { pattern: 'DMart',            categoryName: 'Groceries',    priority: 15 },
  { pattern: 'RELIANCE SMART',   categoryName: 'Groceries',    priority: 15 },
  { pattern: 'NATURE\'S BASKET', categoryName: 'Groceries',    priority: 15 },

  // Transport
  { pattern: 'UBER',             categoryName: 'Transport',    priority: 10 },
  { pattern: 'OLA',              categoryName: 'Transport',    priority: 10 },
  { pattern: 'RAPIDO',           categoryName: 'Transport',    priority: 10 },
  { pattern: 'METRO',            categoryName: 'Transport',    priority: 20 },
  { pattern: 'BMTC',             categoryName: 'Transport',    priority: 20 },
  { pattern: 'BEST BUS',         categoryName: 'Transport',    priority: 20 },
  { pattern: 'IRCTC',            categoryName: 'Travel',       priority: 10 },
  { pattern: 'INDIGO',           categoryName: 'Travel',       priority: 10 },
  { pattern: 'SPICEJET',         categoryName: 'Travel',       priority: 10 },
  { pattern: 'AIR INDIA',        categoryName: 'Travel',       priority: 10 },
  { pattern: 'MAKEMYTRIP',       categoryName: 'Travel',       priority: 10 },
  { pattern: 'GOIBIBO',          categoryName: 'Travel',       priority: 10 },

  // Fuel
  { pattern: 'PETROL',           categoryName: 'Fuel',         priority: 10 },
  { pattern: 'HPCL',             categoryName: 'Fuel',         priority: 10 },
  { pattern: 'BPCL',             categoryName: 'Fuel',         priority: 10 },
  { pattern: 'IOCL',             categoryName: 'Fuel',         priority: 10 },
  { pattern: 'INDIAN OIL',       categoryName: 'Fuel',         priority: 10 },
  { pattern: 'HP PETROL',        categoryName: 'Fuel',         priority: 10 },

  // Utilities
  { pattern: 'JIO',              categoryName: 'Utilities',    priority: 10 },
  { pattern: 'AIRTEL',           categoryName: 'Utilities',    priority: 10 },
  { pattern: 'BSNL',             categoryName: 'Utilities',    priority: 10 },
  { pattern: 'VODAFONE',         categoryName: 'Utilities',    priority: 10 },
  { pattern: 'BESCOM',           categoryName: 'Utilities',    priority: 10 },
  { pattern: 'ELECTRICITY',      categoryName: 'Utilities',    priority: 20 },
  { pattern: 'WATER BOARD',      categoryName: 'Utilities',    priority: 20 },
  { pattern: 'GAS',              categoryName: 'Utilities',    priority: 30 },
  { pattern: 'PIPED GAS',        categoryName: 'Utilities',    priority: 20 },
  { pattern: 'MAHANAGAR GAS',    categoryName: 'Utilities',    priority: 10 },
  { pattern: 'IGL',              categoryName: 'Utilities',    priority: 10 },

  // Health
  { pattern: 'PHARMACY',         categoryName: 'Health',       priority: 20 },
  { pattern: 'MEDPLUS',          categoryName: 'Health',       priority: 10 },
  { pattern: 'APOLLO PHARMACY',  categoryName: 'Health',       priority: 10 },
  { pattern: 'NETMEDS',          categoryName: 'Health',       priority: 10 },
  { pattern: 'HOSPITAL',         categoryName: 'Health',       priority: 20 },
  { pattern: 'CLINIC',           categoryName: 'Health',       priority: 20 },
  { pattern: 'DIAGNOSTIC',       categoryName: 'Health',       priority: 20 },

  // Insurance
  { pattern: 'LIC',              categoryName: 'Insurance',    priority: 10 },
  { pattern: 'HDFC LIFE',        categoryName: 'Insurance',    priority: 10 },
  { pattern: 'ICICI PRU',        categoryName: 'Insurance',    priority: 10 },
  { pattern: 'STAR HEALTH',      categoryName: 'Insurance',    priority: 10 },
  { pattern: 'BAJAJ ALLIANZ',    categoryName: 'Insurance',    priority: 10 },

  // Shopping
  { pattern: 'AMAZON',           categoryName: 'Shopping',     priority: 10 },
  { pattern: 'FLIPKART',         categoryName: 'Shopping',     priority: 10 },
  { pattern: 'MEESHO',           categoryName: 'Shopping',     priority: 10 },
  { pattern: 'MYNTRA',           categoryName: 'Shopping',     priority: 10 },
  { pattern: 'NYKAA',            categoryName: 'Shopping',     priority: 10 },
  { pattern: 'AJIO',             categoryName: 'Shopping',     priority: 10 },

  // Entertainment
  { pattern: 'NETFLIX',          categoryName: 'Subscriptions', priority: 10 },
  { pattern: 'HOTSTAR',          categoryName: 'Subscriptions', priority: 10 },
  { pattern: 'PRIME VIDEO',      categoryName: 'Subscriptions', priority: 10 },
  { pattern: 'SPOTIFY',          categoryName: 'Subscriptions', priority: 10 },
  { pattern: 'YOUTUBE PREMIUM',  categoryName: 'Subscriptions', priority: 10 },
  { pattern: 'PVR',              categoryName: 'Entertainment', priority: 10 },
  { pattern: 'INOX',             categoryName: 'Entertainment', priority: 10 },

  // Investments
  { pattern: 'SIP',              categoryName: 'Investments',  priority: 10 },
  { pattern: 'MUTUAL FUND',      categoryName: 'Investments',  priority: 15 },
  { pattern: 'ZERODHA',          categoryName: 'Investments',  priority: 10 },
  { pattern: 'GROWW',            categoryName: 'Investments',  priority: 10 },
  { pattern: 'KUVERA',           categoryName: 'Investments',  priority: 10 },
  { pattern: 'COIN',             categoryName: 'Investments',  priority: 20 },

  // Cash
  { pattern: 'ATM WDL',          categoryName: 'Cash',         priority: 10 },
  { pattern: 'ATM WITHDRAWAL',   categoryName: 'Cash',         priority: 10 },
  { pattern: 'CASH WITHDRAWAL',  categoryName: 'Cash',         priority: 10 },

  // Income
  { pattern: 'SALARY',           categoryName: 'Salary',       priority: 10 },
  { pattern: 'PAYROLL',          categoryName: 'Salary',       priority: 10 },
  { pattern: 'INTEREST CREDIT',  categoryName: 'Interest',     priority: 10 },
  { pattern: 'INT.CREDIT',       categoryName: 'Interest',     priority: 10 },
  { pattern: 'FD INTEREST',      categoryName: 'Interest',     priority: 10 },

  // Fees
  { pattern: 'ANNUAL FEE',       categoryName: 'Fees & Charges', priority: 10 },
  { pattern: 'LATE FEE',         categoryName: 'Fees & Charges', priority: 10 },
  { pattern: 'GST',              categoryName: 'Fees & Charges', priority: 20 },
  { pattern: 'SERVICE CHARGE',   categoryName: 'Fees & Charges', priority: 10 },

  // Transfers
  { pattern: 'NEFT',             categoryName: 'Self Transfer', priority: 50 },
  { pattern: 'IMPS',             categoryName: 'Self Transfer', priority: 50 },
  { pattern: 'RTGS',             categoryName: 'Self Transfer', priority: 50 },
  { pattern: 'CC PAYMENT',       categoryName: 'CC Payment',    priority: 10 },
  { pattern: 'CREDIT CARD PAYMENT', categoryName: 'CC Payment', priority: 10 },

  // Rent
  { pattern: 'RENT',             categoryName: 'Rent',         priority: 20 },
  { pattern: 'HOUSE RENT',       categoryName: 'Rent',         priority: 10 },

  // Education
  { pattern: 'UDEMY',            categoryName: 'Education',    priority: 10 },
  { pattern: 'COURSERA',         categoryName: 'Education',    priority: 10 },
  { pattern: 'SCHOOL FEE',       categoryName: 'Education',    priority: 10 },
  { pattern: 'COLLEGE FEE',      categoryName: 'Education',    priority: 10 },
  { pattern: 'TUITION',          categoryName: 'Education',    priority: 20 },
];
