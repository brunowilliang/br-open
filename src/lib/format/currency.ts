const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

const currencyFormatterWhole = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  maximumFractionDigits: 0,
  style: "currency",
});

export function formatCurrencyCents(
  cents: number,
  opts?: { whole?: boolean }
): string {
  const formatter = opts?.whole ? currencyFormatterWhole : currencyFormatter;
  return formatter.format(cents / 100).replace(/\u00a0/g, " ");
}

export function formatTrendPercent(
  current: number,
  previous: number
): null | string {
  if (previous === 0) {
    return current > 0 ? "Novo" : null;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) {
    return null;
  }
  return `${pct > 0 ? "+" : ""}${pct}% vs mês anterior`;
}
