import { parseDate, parseIndianAmount, parseDirection } from '../src/import/normalize';

describe('parseDate', () => {
  test('ISO passthrough', () => expect(parseDate('2024-01-15')).toBe('2024-01-15'));
  test('DD/MM/YYYY', () => expect(parseDate('15/01/2024')).toBe('2024-01-15'));
  test('DD-MM-YYYY', () => expect(parseDate('15-01-2024')).toBe('2024-01-15'));
  test('DD-MMM-YYYY', () => expect(parseDate('15-Jan-2024')).toBe('2024-01-15'));
  test('DD MMM YY', () => expect(parseDate('15 Jan 24')).toBe('2024-01-15'));
  test('DD/MM/YY', () => expect(parseDate('15/01/24')).toBe('2024-01-15'));
  test('throws on garbage', () => expect(() => parseDate('not-a-date')).toThrow());
});

describe('parseIndianAmount', () => {
  test('plain', () => expect(parseIndianAmount('1234.56')).toBe(1234.56));
  test('Indian grouping', () => expect(parseIndianAmount('1,23,456.78')).toBe(123456.78));
  test('with rupee symbol', () => expect(parseIndianAmount('₹1,500.00')).toBe(1500));
  test('negative becomes positive', () => expect(parseIndianAmount('-500')).toBe(500));
});

describe('parseDirection', () => {
  test('DR → debit', () => expect(parseDirection('DR')).toBe('debit'));
  test('CR → credit', () => expect(parseDirection('CR')).toBe('credit'));
  test('Debit → debit', () => expect(parseDirection('Debit')).toBe('debit'));
  test('Credit → credit', () => expect(parseDirection('Credit')).toBe('credit'));
  test('negative amount infers debit', () => expect(parseDirection('', -100)).toBe('debit'));
  test('positive amount infers credit', () => expect(parseDirection('', 100)).toBe('credit'));
});
