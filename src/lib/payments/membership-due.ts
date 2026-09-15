import { BRAZIL_UTC_OFFSET_MS } from "@convex/domains/payment/rules";

import { formatCount } from "@/lib/format/pluralize";
import { DAY_MS } from "@/lib/format/relative-time";

/**
 * Rótulo dos dias que faltam para o vencimento no CALENDÁRIO DO BRASIL:
 * "hoje", "amanhã" ou "em N dias".
 *
 * A conta usa o offset fixo do domínio de pagamento (`BRAZIL_UTC_OFFSET_MS`,
 * UTC-3 sem horário de verão) — nunca o fuso do aparelho — para o app e a
 * notificação do servidor darem sempre o mesmo texto, e por dia de calendário:
 * vencimento daqui a 6 horas ainda é hoje.
 */
export function formatBrazilDueDayLabel(dueAt: number, now: number): string {
  const dueDayIndex = Math.floor((dueAt + BRAZIL_UTC_OFFSET_MS) / DAY_MS);
  const todayDayIndex = Math.floor((now + BRAZIL_UTC_OFFSET_MS) / DAY_MS);
  const days = dueDayIndex - todayDayIndex;

  if (days <= 0) {
    return "hoje";
  }

  if (days === 1) {
    return "amanhã";
  }

  return `em ${formatCount(days, "dia", "dias")}`;
}
