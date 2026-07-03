// Shared display-formatting utilities. Call setLocaleConfig() at app startup
// with the user's saved currency preference to avoid hardcoding INR/en-IN.

interface LocaleConfig {
  currencyCode: string;
  locale: string;
}

let config: LocaleConfig = { currencyCode: 'INR', locale: 'en-IN' };

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  AED: 'د.إ',
};

export function setLocaleConfig(cfg: Partial<LocaleConfig>): void {
  config = { ...config, ...cfg };
}

export function getLocaleConfig(): LocaleConfig {
  return { ...config };
}

export function currencySymbol(): string {
  return CURRENCY_SYMBOLS[config.currencyCode] ?? config.currencyCode;
}

/** Format an integer paise value as a human-readable currency string. */
export function formatCurrency(paise: number): string {
  const rupees = paise / 100;
  return currencySymbol() + rupees.toLocaleString(config.locale, { maximumFractionDigits: 2 });
}

/** Format a paise value rounding to whole units (no decimals). */
export function formatCurrencyWhole(paise: number): string {
  const rupees = Math.round(paise / 100);
  return currencySymbol() + rupees.toLocaleString(config.locale);
}

/** Format an ISO date string (YYYY-MM-DD) for display. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  if (!year || !month || !day) return isoDate;
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString(config.locale, { day: '2-digit', month: 'short', year: 'numeric' });
}
