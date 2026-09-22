/** Regras puras de inscrição: nome da categoria e gates de gênero. */
import {
  PLAYER_GENDER_FEMALE,
  PLAYER_GENDER_MALE,
  type TournamentGender,
  type TournamentModality,
} from "./contract";
const MODALITY_LABEL: Record<TournamentModality, string> = {
  doubles: "Duplas",
  singles: "Simples",
};

const SINGLES_GENDER_LABEL: Record<TournamentGender, string> = {
  female: "Feminino",
  male: "Masculino",
  mixed: "Misto",
};

const DOUBLES_GENDER_LABEL: Record<TournamentGender, string> = {
  female: "Femininas",
  male: "Masculinas",
  mixed: "Mistas",
};

export function buildCategoryDisplayName(
  modality: TournamentModality,
  gender: TournamentGender
) {
  const genderLabel =
    modality === "singles"
      ? SINGLES_GENDER_LABEL[gender]
      : DOUBLES_GENDER_LABEL[gender];
  return `${MODALITY_LABEL[modality]} ${genderLabel}`;
}

export type GenderCheckInput = {
  gender: TournamentGender;
  modality: TournamentModality;
  playerAGender: string | null | undefined;
  playerBGender: string | null | undefined;
};

const MIXED_GENDER_REQUIRED_MESSAGE =
  "Duplas mistas exigem o gênero definido no perfil dos dois jogadores.";

/**
 * Recusa carrega `reason` (frase completa) e `label` (chip de até 2
 * palavras); perfil sem gênero é legado e não tem chip.
 */
export type CategoryCallerEligibility =
  | { eligible: true; label: null; reason: null }
  | { eligible: false; label: null | string; reason: string };

/**
 * Fonte única do gate do create e dos flags expostos ao app. Categoria de
 * gênero fixo aceita só o gênero do CALLER; `mixed` de duplas exige gênero
 * definido (resolve o parceiro oposto) e `Simples Misto` não gateia.
 */
export function resolveCallerEligibility(input: {
  gender: TournamentGender;
  modality: TournamentModality;
  playerAGender: null | string | undefined;
}): CategoryCallerEligibility {
  if (input.gender === "mixed") {
    if (input.modality !== "doubles") {
      return { eligible: true, label: null, reason: null };
    }
    const isDefined =
      input.playerAGender === PLAYER_GENDER_MALE ||
      input.playerAGender === PLAYER_GENDER_FEMALE;
    return isDefined
      ? { eligible: true, label: null, reason: null }
      : {
          eligible: false,
          label: null,
          reason: MIXED_GENDER_REQUIRED_MESSAGE,
        };
  }

  const expectedGender =
    input.gender === "male" ? PLAYER_GENDER_MALE : PLAYER_GENDER_FEMALE;
  if (input.playerAGender === expectedGender) {
    return { eligible: true, label: null, reason: null };
  }

  const isDefined =
    input.playerAGender === PLAYER_GENDER_MALE ||
    input.playerAGender === PLAYER_GENDER_FEMALE;
  return {
    eligible: false,
    // Definido e divergente = categoria do outro gênero; ausente = legado.
    label: isDefined ? (input.gender === "male" ? "Homens" : "Mulheres") : null,
    reason: `Você não pode se inscrever em ${buildCategoryDisplayName(input.modality, input.gender)}. A categoria aceita apenas o gênero ${input.gender === "male" ? "masculino" : "feminino"}.`,
  };
}

/**
 * O gate do CALLER roda primeiro em toda modalidade, inclusive nas duplas de
 * gênero fixo; só depois o gate do PARCEIRO (`mixed` = um de cada gênero,
 * ambos definidos).
 */
export function validateEntryGenders(input: GenderCheckInput) {
  const caller = resolveCallerEligibility({
    gender: input.gender,
    modality: input.modality,
    playerAGender: input.playerAGender,
  });
  if (!caller.eligible) {
    return caller.reason;
  }

  if (input.modality !== "doubles") {
    return null;
  }

  if (input.gender === "mixed") {
    if (!(input.playerAGender && input.playerBGender)) {
      return MIXED_GENDER_REQUIRED_MESSAGE;
    }

    const hasMale =
      input.playerAGender === PLAYER_GENDER_MALE ||
      input.playerBGender === PLAYER_GENDER_MALE;
    const hasFemale =
      input.playerAGender === PLAYER_GENDER_FEMALE ||
      input.playerBGender === PLAYER_GENDER_FEMALE;

    if (!(hasMale && hasFemale)) {
      return "Duplas mistas são formadas por 1 homem e 1 mulher.";
    }

    return null;
  }

  if (input.gender === "male" && input.playerBGender !== PLAYER_GENDER_MALE) {
    return "Duplas Masculinas exigem parceiro com o gênero masculino definido no perfil.";
  }
  if (
    input.gender === "female" &&
    input.playerBGender !== PLAYER_GENDER_FEMALE
  ) {
    return "Duplas Femininas exigem parceiro com o gênero feminino definido no perfil.";
  }
  return null;
}

/** Gênero exigido do PARCEIRO: o da categoria, ou o oposto do caller. */
export function resolvePartnerGenderTarget(input: {
  categoryGender: TournamentGender;
  playerGender: null | string | undefined;
}): "Feminino" | "Masculino" | null {
  if (input.categoryGender === "male") {
    return PLAYER_GENDER_MALE;
  }
  if (input.categoryGender === "female") {
    return PLAYER_GENDER_FEMALE;
  }
  if (input.playerGender === PLAYER_GENDER_MALE) {
    return PLAYER_GENDER_FEMALE;
  }
  if (input.playerGender === PLAYER_GENDER_FEMALE) {
    return PLAYER_GENDER_MALE;
  }
  return null;
}

/** `null` quando o gate do CALLER já recusaria: nada a sugerir na busca. */
export function resolvePartnerSearchGender(input: {
  categoryGender: TournamentGender;
  modality: TournamentModality;
  playerAGender: null | string | undefined;
}): "Feminino" | "Masculino" | null {
  const caller = resolveCallerEligibility({
    gender: input.categoryGender,
    modality: input.modality,
    playerAGender: input.playerAGender,
  });
  if (!caller.eligible) {
    return null;
  }

  return resolvePartnerGenderTarget({
    categoryGender: input.categoryGender,
    playerGender: input.playerAGender,
  });
}

export function resolveEntryStatusAfterPartnerAccepted(input: {
  approvalMode: "auto" | "manual";
  entryFeeCents: number;
}) {
  if (input.entryFeeCents > 0) {
    return input.approvalMode === "manual"
      ? ("pending_approval" as const)
      : ("awaiting_payment" as const);
  }
  return input.approvalMode === "manual"
    ? ("pending_approval" as const)
    : ("active" as const);
}

/** Espelha a normalização do plugin de username do better-auth (minúsculo). */
export function normalizeUsernameLookup(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Status em que a inscrição RESERVA as vagas; os terminais guardam a linha
 * para histórico, mas a limpeza das colunas espelhadas com `unsetToken`
 * tira o jogador do índice — sem isso cancelar bloquearia a reinscrição.
 */
export const ENTRY_LIVE_STATUSES = [
  "pending_partner",
  "pending_approval",
  "awaiting_payment",
  "active",
] as const;

export type TournamentEntryLiveStatus = (typeof ENTRY_LIVE_STATUSES)[number];

export function isLiveEntryStatus(
  status: string
): status is TournamentEntryLiveStatus {
  return (ENTRY_LIVE_STATUSES as readonly string[]).includes(status);
}

/**
 * Só status vivo reserva as colunas espelhadas; no terminal a limpeza é
 * `unsetToken`, nunca `null` (nulo também entra no índice e colide).
 */
export function entrySlotFields<T extends string>(input: {
  playerAId: T;
  playerBId?: null | T;
  status: string;
}): { activeAId?: T; activeBId?: T } {
  if (!isLiveEntryStatus(input.status)) {
    return {};
  }
  return {
    activeAId: input.playerAId,
    ...(input.playerBId ? { activeBId: input.playerBId } : {}),
  };
}

/** Quem não tem username nem chega aqui: o índice não contém essas linhas. */
export function selectUsernameMatches(input: {
  limit: number;
  prefix: string;
  users: ReadonlyArray<{ id: string; username?: null | string }>;
}): Array<{ id: string; username: string }> {
  return input.users
    .filter(
      (user): user is { id: string; username: string } =>
        typeof user.username === "string" &&
        user.username.startsWith(input.prefix)
    )
    .sort((a, b) =>
      a.username < b.username ? -1 : a.username > b.username ? 1 : 0
    )
    .slice(0, input.limit);
}

/**
 * Aberta em `published`/`drawn` até o prazo: o sorteio não fecha as
 * inscrições, só o prazo fecha. Fonte única de `entries.ts` e `charge.ts`.
 */
export function isRegistrationOpen(input: {
  nowMs: number;
  registrationDeadlineMs: number;
  status: string;
}) {
  if (input.status !== "published" && input.status !== "drawn") {
    return false;
  }
  return input.registrationDeadlineMs > input.nowMs;
}

export function registrationClosedMessage(input: {
  nowMs: number;
  registrationDeadlineMs: number;
  status: string;
}) {
  if (input.status === "published" || input.status === "drawn") {
    return "O prazo de inscrições já encerrou.";
  }
  return "As inscrições deste torneio estão fechadas.";
}

/**
 * Último gate do ACTIVE: conta só inscrições ACTIVE; pagamento que estouraria
 * `maxEntries` segue o padrão de refund (inscrição cancelada, cobrança em
 * refund-pending) em vez de espremer mais um na chave.
 */
export function resolvePaidActivation(input: {
  activeCount: number;
  maxEntries: number | null;
}) {
  if (input.maxEntries === null) {
    return "activate" as const;
  }
  return input.activeCount < input.maxEntries
    ? ("activate" as const)
    : ("refund" as const);
}

export function isEntryDrawable(status: string) {
  return status === "active";
}

/** Ids das inscrições do viewer (não canceladas) — viram `viewerEntryIds`. */
export function selectViewerTournamentEntryIds(input: {
  categoryIds: readonly string[];
  entries: readonly { categoryId: string; id: string; status: string }[];
}): string[] {
  const tournamentCategoryIds = new Set(input.categoryIds);
  return input.entries
    .filter(
      (entry) =>
        entry.status !== "cancelled" &&
        tournamentCategoryIds.has(entry.categoryId)
    )
    .map((entry) => entry.id);
}
