const NAME_PARTS_SPLIT_REGEX = /\s+/;

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
    case "invite_only":
      return "Convite";
    case "private":
      return "Privada";
    default:
      return "Liga";
  }
}

export function formatLeagueVisibilityOptionLabel(value: string) {
  switch (value) {
    case "invite_only":
      return "Somente convite";
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

export function formatChallengeStatus(status?: string | null) {
  switch (status) {
    case "pending_response":
      return "Aguardando resposta";
    case "accepted":
      return "Aceito";
    case "scheduled":
      return "Agendado";
    case "declined":
      return "Recusado";
    case "expired_response":
      return "Expirado";
    case "finished":
      return "Finalizado";
    case "walkover":
      return "W.O.";
    case "cancelled":
      return "Cancelado";
    default:
      return "Desafio";
  }
}

export function getChallengeStatusColor(status?: string | null) {
  switch (status) {
    case "finished":
      return "success";
    case "declined":
    case "cancelled":
      return "danger";
    case "pending_response":
      return "warning";
    default:
      return "accent";
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
    return "Solicitação pendente";
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
    return "GOOD MORNING";
  }

  if (hour < 18) {
    return "GOOD AFTERNOON";
  }

  return "GOOD NIGHT";
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
