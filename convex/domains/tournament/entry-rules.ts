/**
 * Pure tournament entry rules (IBX-0010 slice 2): category naming and
 * gender validation for doubles `mixed` (spec: 1 man + 1 woman, both with
 * gender defined on their player profile).
 */
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
 * Dois textos por recusa: `reason` é a frase pt-BR completa (erro/recusa do
 * create, sem limite de espaço) e `label` é o rótulo de CHIP, no máximo 2
 * palavras (micro-ajuste de copy 20-09). O caso "perfil sem gênero" é legado
 * (a escrita do perfil exige gender) e não tem chip: `label` vai null e a
 * frase longa segue no `reason`.
 */
export type CategoryCallerEligibility =
  | { eligible: true; label: null; reason: null }
  | { eligible: false; label: null | string; reason: string };

/**
 * Caller eligibility for ONE category (IBX-0074 r27) — the single source
 * behind the create gate (composed into `validateEntryGenders` below) and
 * the per-category flags the tournament read exposes to the app, so the
 * client never re-implements the rule. Fixed-gender categories
 * (simples masculino/feminino, duplas masculinas/femininas) admit only a
 * caller whose profile gender matches; `mixed` admits any caller, but the
 * DOUBLES flow needs a defined gender to resolve the opposite partner
 * (r25 `resolvePartnerGenderTarget`), so an undefined profile is refused
 * there; `Simples Misto` has no partner and no gate.
 *
 * Ineligible results carry BOTH texts: `reason` (the full pt-BR sentence for
 * the create refusal) and `label` (≤2 words for the badge the app renders —
 * the chip has no room for a sentence, micro-ajuste 20-09). A profile without
 * a gender has no badge at all (legacy state; the profile write requires
 * gender), so `label` is null there and only `reason` is filled.
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
    // Gênero definido e divergente = a categoria é do outro gênero (rótulo
    // curto pro chip); gênero ausente = caso legado, sem badge.
    label: isDefined ? (input.gender === "male" ? "Homens" : "Mulheres") : null,
    reason: `Você não pode se inscrever em ${buildCategoryDisplayName(input.modality, input.gender)}. A categoria aceita apenas o gênero ${input.gender === "male" ? "masculino" : "feminino"}.`,
  };
}

/**
 * Gender gate of an entry (IBX-0074 r25 + r27): the CALLER gate runs first
 * in every modality (r27 closed the r25 hole where a male profile could
 * register in Duplas Femininas as long as the invited partner was female);
 * then, in doubles, the PARTNER gate — `mixed` requires exactly one
 * "Masculino" + one "Feminino", both defined, and `male`/`female`
 * categories require the partner (playerB) to match the category gender.
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

/**
 * Gender the PARTNER must have for the caller to invite them into a
 * category (IBX-0074 r25): fixed by the category for male/female; the
 * OPPOSITE of the caller's gender for mixed. `null` means "cannot decide"
 * (mixed with the caller's gender undefined) — the search returns nobody
 * and the create gate rejects with its own clear message.
 */
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

/**
 * Gate of the partner search (IBX-0074 r25 + r27 review MEDIUM): the gender
 * the suggestions may have, or `null` when the search must offer NOTHING.
 * The CALLER gate runs first — a viewer the category would refuse (fixed
 * gender mismatch, or `mixed` without a defined gender) gets no suggestion
 * at all, so the autocomplete never offers what `create` would answer with
 * an error; then `resolvePartnerGenderTarget` decides the candidate gender.
 * Single source consumed by `players.searchByUsername` (the procedure never
 * re-implements either rule).
 */
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

/**
 * An entry joins a paid category through `awaiting_payment` (checkout is
 * the gate) or, in manual approval, through `pending_approval`. Free
 * categories with manual approval also use `pending_approval`; free +
 * auto approve straight to `active`.
 */
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

/**
 * Canonical username lookup form — mirrors the better-auth username plugin
 * normalization (lowercase; the stored value is always lowercase). Used by
 * the partner invite and by `players.searchByUsername` so both sides agree
 * on the same key. Prefix search (IBX-0074 r18-A): the caller sends partial
 * text, matches are case-insensitive by normalization.
 */
export function normalizeUsernameLookup(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Statuses where an entry RESERVES its players' slots in the category.
 * Terminal statuses (`cancelled`, `rejected`) keep the row for history but
 * must not hold the player: the DB unique indexes key on the mirrored
 * `activeAId`/`activeBId` columns, which mutations clear (unsetToken) when
 * an entry goes terminal. IBX-0074 r19: terminal rows used to sit on the
 * `categoryId_playerAId`/`categoryId_playerBId` unique indexes forever and
 * blocked re-registration after a cancel.
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
 * Mirror slot columns for an entry insert: live statuses reserve the
 * players, terminal statuses reserve nothing. Terminal transitions must
 * clear the columns with `unsetToken` (never `null` — a null value would
 * still be indexed and two cancelled entries in the same category would
 * collide).
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

/**
 * Partner autocomplete matches (IBX-0074 r18-A): users whose username
 * starts with the normalized prefix, alphabetical, capped at `limit`.
 * Users without a username are not findable (the username index never
 * contains them, so they don't even reach this selector).
 */
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
 * Registration window (IBX-0067 / PLN-0001): open while the tournament is
 * `published` OR `drawn` — drawing no longer closes entries (the deadline
 * is the only closer) — and the deadline has not passed. `ongoing` and the
 * earlier/terminal states are closed. Single source shared by the entry
 * mutations (entries.ts) and the paid-charge activator (charge.ts M1).
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

/**
 * User-facing reason the window is closed: the deadline passed while the
 * state would still allow entries (published/drawn), or the state itself
 * forbids them. Single source shared by entries.ts and the checkout
 * resolver (charge.ts).
 */
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
 * The LAST gate for reaching ACTIVE (IBX-0067 review HIGH-1): every path
 * that activates an entry counts ACTIVE entries only, and a PAID
 * activation that would overflow maxEntries follows the refund pattern
 * (entry cancelled, charge refund-pending) instead of squeezing in.
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

/** Entries that take part in the draw (spec: draw uses active entries). */
export function isEntryDrawable(status: string) {
  return status === "active";
}

/**
 * BUG-0017: the viewer's entries in a tournament — non-cancelled entries
 * whose category belongs to it. Single source for both the detail gate
 * (`discovery.getById`) and the entries listing gate
 * (`entries.listForTournament`); the returned ids double as the
 * client-facing `viewerEntryIds`.
 */
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
