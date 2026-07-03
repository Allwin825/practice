import { ParsedFileMeta, StatementParser } from '../types';
import { GenericCsvParser } from './parsers/genericCsv';

const REGISTERED_PARSERS: StatementParser[] = [
  new GenericCsvParser(),
];

export function detectParser(
  file: ParsedFileMeta,
  firstBytes?: string
): StatementParser {
  let best: StatementParser = new GenericCsvParser();
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
