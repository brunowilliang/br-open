const NAME_PARTS_SPLIT_REGEX = /\s+/;
const LIMITED_AVAILABILITY_THRESHOLD = 10;

type LeaguePriceBillingInterval = "month" | "quarter" | "week" | "year";

const leaguePriceBillingIntervalSuffixes: Record<
  LeaguePriceBillingInterval,
  string
> = {
  month: "/mês",
  quarter: "/trimestre",
  week: "/semana",
  year: "/ano",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  })
    .format(value / 100)
    .replace(/\u00a0/g, " ");
}

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
    amount: formatCurrency(input.amountCents),
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
    case "pending":
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
  options?: { isManagerOwner?: boolean }
) {
  if (status === "active") {
    return "Abrir";
  }

  if (status === "pending") {
    return "Pendente";
  }

  if (status === "rejected") {
    return "Solicitar novamente";
  }

  if (options?.isManagerOwner) {
    return "Entrar como jogador";
  }

  return "Solicitar entrada";
}

export function getGreetingLabel(now = new Date()) {
  const hour = now.getHours();

  if (hour < 12) {
    return "Bom dia";
  }

  if (hour < 18) {
    return "Boa tarde";
  }

  return "Boa noite";
}

export function getUserInitials(
  name?: string | null,
  fallback?: string | null
) {
  const normalizedName = name?.trim();

  if (normalizedName) {
    return normalizedName
      .split(NAME_PARTS_SPLIT_REGEX)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }

  return (fallback ?? "?").slice(0, 2).toUpperCase();
}
