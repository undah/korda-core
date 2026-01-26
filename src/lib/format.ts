export type CurrencyCode = "USD" | "EUR";
export type PnlFormat = "money" | "percent" | "both";

export function normalizeCurrency(input?: string | null): CurrencyCode {
  const c = (input ?? "USD").toUpperCase();
  return c === "EUR" ? "EUR" : "USD";
}

export function formatCurrency(value: number, currency?: string | null, locale: string = "en-US") {
  const safeCurrency = normalizeCurrency(currency);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    const symbol = safeCurrency === "EUR" ? "€" : "$";
    const sign = value < 0 ? "-" : "";
    return `${sign}${symbol}${Math.abs(value).toFixed(2)}`;
  }
}

export function formatPercent(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.0%";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function formatPnl(
  pnl: number,
  pnlPct: number,
  opts: { currency?: string | null; locale?: string; format?: PnlFormat }
) {
  const { currency, locale = "en-US", format = "money" } = opts;

  if (format === "percent") return formatPercent(pnlPct);

  const money = formatCurrency(pnl, currency, locale);

  if (format === "both") {
    return `${money} • ${formatPercent(pnlPct)}`;
  }

  return money; // money
}
