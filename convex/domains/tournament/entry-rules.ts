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

/**
 * Only `doubles` + `mixed` validates profile genders (spec decision):
 * exactly one "Masculino" + one "Feminino", both defined. Other
 * categories don't gate on profile gender in v1.
 */
export function validateEntryGenders(input: GenderCheckInput) {
  if (input.modality !== "doubles" || input.gender !== "mixed") {
    return null;
  }

  if (!(input.playerAGender && input.playerBGender)) {
    return "Duplas mistas exigem o gênero definido no perfil dos dois jogadores.";
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
 * on the same key. Exact match only (no fuzzy) per the invite design.
 */
export function normalizeUsernameLookup(value: string) {
  return value.trim().toLowerCase();
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
