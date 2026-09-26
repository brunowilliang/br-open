import { formatCurrencyCents } from "@/lib/format/currency";

type PriceBillingInterval = "month" | "once" | "quarter" | "week" | "year";

const priceBillingIntervalSuffixes: Record<PriceBillingInterval, string> = {
  month: "/mês",
  once: " (único)",
  quarter: "/trimestre",
  week: "/semana",
  year: "/ano",
};

export function formatPriceParts(input: {
  amountCents: number;
  billingInterval: PriceBillingInterval;
}) {
  if (input.amountCents <= 0) {
    return {
      amount: "Grátis",
      suffix: null,
    };
  }

  return {
    amount: formatCurrencyCents(input.amountCents),
    suffix: priceBillingIntervalSuffixes[input.billingInterval],
  };
}

export function formatCompetitionMeta(
  city?: string | null,
  state?: string | null
) {
  if (city && state) {
    return `${city} · ${state}`;
  }

  return city || state || "Sem local definido";
}
