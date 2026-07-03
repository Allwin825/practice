import { ParsedFileMeta, StatementParser } from '../types';
import { HdfcCsvParser } from './parsers/hdfcCsv';
import { IciciBankCsvParser } from './parsers/iciciBankCsv';
import { SbiCsvParser } from './parsers/sbiCsv';
import { GenericCsvParser } from './parsers/genericCsv';
import { XlsxParser } from './parsers/xlsxParser';

// Bank-specific parsers are registered first so they get priority over generic CSV
const REGISTERED_PARSERS: StatementParser[] = [
  new HdfcCsvParser(),
  new IciciBankCsvParser(),
  new SbiCsvParser(),
  new GenericCsvParser(),
  new XlsxParser(),
];

// Returns null when no registered parser recognises the file (all scores are 0).
// Callers must surface an "unrecognised format" error rather than silently
// falling back to HDFC (fix I-4).
export function detectParser(
  file: ParsedFileMeta,
  firstBytes?: string
): StatementParser | null {
  let best: StatementParser | null = null;
  let bestScore = 0;

  for (const parser of REGISTERED_PARSERS) {
    const score = parser.canParse(file, firstBytes);
    if (score > bestScore) {
      bestScore = score;
      best = parser;
    }
  }
  return best;
}

export function registerParser(parser: StatementParser): void {
  REGISTERED_PARSERS.push(parser);
}
