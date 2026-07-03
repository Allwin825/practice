export type AccountKind = 'bank' | 'credit_card' | 'wallet';
export type Direction = 'debit' | 'credit';
export type CategoryKind = 'expense' | 'income' | 'transfer';
export type CategorySource = 'rule' | 'learned' | 'manual' | 'uncategorized';
export type RuleSource = 'seed' | 'user' | 'learned';

export interface Account {
  id: number;
  name: string;
  bank: string;
  kind: AccountKind;
  last_txn_date: string | null;
}

export interface ImportBatch {
  id: number;
  account_id: number;
  file_name: string | null;
  imported_at: string;
  stmt_start: string | null;
  stmt_end: string | null;
  rows_in_file: number;
  rows_inserted: number;
  rows_skipped_dupe: number;
}

export interface Transaction {
  id: number;
  account_id: number;
  batch_id: number;
  txn_date: string;
  narration: string;
  ref_no: string | null;
  amount: number;
  direction: Direction;
  balance_after: number | null;
  category_id: number | null;
  category_source: CategorySource;
  txn_hash: string;
  notes: string | null;
}

export interface Category {
  id: number;
  name: string;
  kind: CategoryKind;
  icon: string | null;
  color: string | null;
  is_system: number;
}

export interface CategoryRule {
  id: number;
  pattern: string;
  category_id: number;
  priority: number;
  source: RuleSource;
}

export interface Budget {
  id: number;
  month: string;
  category_id: number | null;
  planned_amount: number;
}

export interface RawTransaction {
  txn_date: string;
  narration: string;
  ref_no?: string;
  amount: number;
  direction: Direction;
  balance_after?: number;
}

export interface ParsedFileMeta {
  name: string;
  extension: string;
  size: number;
  uri: string;
}

export interface StatementParser {
  bank: string;
  canParse(file: ParsedFileMeta, firstBytes?: string): number;
  parse(fileContent: string | ArrayBuffer, meta: ParsedFileMeta): Promise<RawTransaction[]>;
}

export interface ReviewRow extends RawTransaction {
  suggested_category_id: number | null;
  category_source: CategorySource;
  skip: boolean;
  txn_hash: string;
  is_dupe: boolean;
  intra_day_ordinal: number;
}

export interface MonthlySpend {
  month: string;
  category_name: string;
  spent: number;
}

export interface BudgetActual {
  month: string;
  category_id: number | null;
  category_name: string;
  planned_amount: number;
  actual_amount: number;
}
