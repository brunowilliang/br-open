import { formatCurrencyCents } from "@/lib/format/currency";
import { getGreetingLabel, getUserInitials } from "@/lib/format/user";

export { getGreetingLabel, getUserInitials };

const LIMITED_AVAILABILITY_THRESHOLD = 10;

type LeaguePriceBillingInterval =
  | "month"
  | "once"
  | "quarter"
  | "week"
  | "year";

const leaguePriceBillingIntervalSuffixes: Record<
  LeaguePriceBillingInterval,
  string
> = {
  month: "/mês",
  once: " (único)",
  quarter: "/trimestre",
  week: "/semana",
  year: "/ano",
};

export function getLeagueAvailableSpotCount(input: {
  activePlayerCount: number;
  maxPlayers?: null | number;
}) {
  if (input.maxPlayers === null || input.maxPlayers === undefined) {
    return null;
  }

  return Math.max(0, input.maxPlayers - input.activePlayerCount);
}

export function hasLeagueAvailableSpots(input: {
  activePlayerCount: number;
  maxPlayers?: null | number;
}) {
  const availableSpotCount = getLeagueAvailableSpotCount(input);

  return availableSpotCount === null || availableSpotCount > 0;
}

export function formatLeagueAvailabilityBadge(input: {
  activePlayerCount: number;
  maxPlayers?: null | number;
}) {
  const availableSpotCount = getLeagueAvailableSpotCount(input);

  if (availableSpotCount === 0) {
    return null;
  }

  if (
    availableSpotCount !== null &&
    availableSpotCount < LIMITED_AVAILABILITY_THRESHOLD
  ) {
    return `${availableSpotCount} ${
      availableSpotCount === 1 ? "vaga disponível" : "vagas disponíveis"
    }`;
  }

  return "Vagas Disponíveis";
}

export function formatLeaguePriceParts(input: {
  amountCents: number;
  billingInterval: LeaguePriceBillingInterval;
}) {
  if (input.amountCents <= 0) {
    return {
      amount: "Grátis",
      suffix: null,
    };
  }

  return {
    amount: formatCurrencyCents(input.amountCents),
    suffix: leaguePriceBillingIntervalSuffixes[input.billingInterval],
  };
}

export function formatLeagueMonthlyPrice(value: number) {
  const priceParts = formatLeaguePriceParts({
    amountCents: value,
    billingInterval: "month",
  });

  return `${priceParts.amount}${priceParts.suffix ?? ""}`;
}

export function formatLeagueMeta(city?: string | null, state?: string | null) {
  if (city && state) {
    return `${city} · ${state}`;
  }

  return city || state || "Sem local definido";
}

export function formatLeagueVisibility(visibility?: string | null) {
  switch (visibility) {
    case "public":
      return "Pública";
    case "private":
      return "Privada";
    default:
      return "Liga";
  }
}

export function formatLeagueVisibilityOptionLabel(value: string) {
  switch (value) {
    case "private":
      return "Privada";
    default:
      return "Pública";
  }
}

export function formatLeagueStatus(status?: string | null) {
  switch (status) {
    case "open":
      return "Aberta";
    case "active":
      return "Em jogo";
    case "paused":
      return "Pausada";
    case "completed":
      return "Concluída";
    case "archived":
      return "Arquivada";
    case "draft":
      return "Rascunho";
    default:
      return "Status";
  }
}

export function formatLeagueStatusOptionLabel(value: string) {
  switch (value) {
    case "draft":
      return "Rascunho";
    case "open":
      return "Aberta";
    case "active":
      return "Ativa";
    case "paused":
      return "Pausada";
    case "completed":
      return "Concluída";
    default:
      return "Arquivada";
  }
}

export function formatMembershipStatus(status?: string | null) {
  switch (status) {
    case "active":
      return "Ativo";
    case "awaiting_payment":
      return "Aguardando pagamento";
    case "payment_due":
      return "Pagamento atrasado";
    case "pending":
      return "Pendente";
    case "rejected":
      return "Rejeitado";
    case "removed":
      return "Removido";
    case "left":
      return "Saiu";
    case "suspended":
      return "Suspenso";
    default:
      return "Sem vínculo";
  }
}

export function getMembershipStatusColor(status?: string | null) {
  switch (status) {
    case "active":
      return "success";
    case "awaiting_payment":
    case "pending":
      return "warning";
    case "payment_due":
    case "suspended":
      return "warning";
    case "removed":
    case "rejected":
      return "danger";
    default:
      return "default";
  }
}

export function getMembershipActionLabel(
  status?: string | null,
  options?: { isLeagueOrganizer?: boolean }
) {
  if (status === "active") {
    return "Abrir";
  }

  if (status === "awaiting_payment") {
    return "Pagar inscrição";
  }

  if (status === "payment_due") {
    return "Pagar agora";
  }

  if (status === "suspended") {
    return "Renovar inscrição";
  }

  if (status === "pending") {
    return "Pendente";
  }

  if (status === "rejected") {
    return "Solicitar novamente";
  }

  if (options?.isLeagueOrganizer) {
    return "Entrar como jogador";
  }

  return "Solicitar entrada";
}
