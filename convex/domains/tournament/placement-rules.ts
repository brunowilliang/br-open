/**
 * Incremental bracket placement (IBX-0067 / PLN-0001, Etapa 1). While the
 * tournament has NOT started (`published` or `drawn`), the bracket is the
 * live mirror of the entries: the moment an entry reaches `active` it joins
 * its category bracket, and a cancellation leaves an empty slot behind.
 *
 * Decisions that shape the rules (plano v3, decisões 7 e 8 do usuário):
 * - A newly confirmed entry fits a RANDOM open first-round side (injected
 *   pick). No automatic bye re-derivation happens on placement.
 * - A full bracket GROWS one power of two by inserting a new first round
 *   BELOW: every existing match moves up one round and every existing pair
 *   is preserved; each entrant descends into its own new round-1 row as a
 *   resolved bye (walkover), so the tournament stays startable.
 * - A cancelled entry leaves its slot EMPTY ("A definir") — the survivor
 *   never receives an automatic walkover (decisão 8). Starting with the
 *   hole stays refused by `validateBracketStartable` (bracket-rules).
 *
 * Pure rules only: deterministic given the injected randomness, Convex-free,
 * heavily unit-tested next to this file (molde bracket-rules).
 */
import {
  buildBracket,
  type BracketSeedEntry,
  type BracketSwapCoordinate,
  type BuiltBracketMatch,
  type SwapMatchStatus,
} from "./bracket-rules";

/** Board row the placement rules read (same shape the move rules use). */
export type PlacementBoardMatch = {
  entryAId: string | null;
  entryBId: string | null;
  /** Present for parity with SwapBoardMatch; pre-start it is always false. */
  hasPublishedResult: boolean;
  id: string;
  round: number;
  slotInRound: number;
  status: SwapMatchStatus;
  walkover: boolean;
  winnerEntryId: string | null;
};

/** Row rewrite the procedure persists after a fit/removal/growth. */
export type PlacementPersistUpdate = {
  bumpRowVersion: boolean;
  entryAId: string | null;
  entryBId: string | null;
  id: string;
  round: number;
  slotInRound: number;
  status: SwapMatchStatus;
  walkover: boolean;
  winnerEntryId: string | null;
};

/** New row a birth/growth inserts (no id yet). */
export type PlacementInsert = {
  entryAId: string | null;
  entryBId: string | null;
  round: number;
  slotInRound: number;
  status: SwapMatchStatus;
  walkover: boolean;
  winnerEntryId: string | null;
};

/** Bracket rows for a category drawn from scratch (buildBracket output). */
export function toPlacementInserts(
  bracket: BuiltBracketMatch[]
): PlacementInsert[] {
  return bracket.map((match) => ({
    entryAId: match.entryAId,
    entryBId: match.entryBId,
    round: match.round,
    slotInRound: match.slotInRound,
    status: match.isVacant ? "vacant" : match.isBye ? "walkover" : "pending",
    walkover: match.isBye,
    winnerEntryId: match.winnerEntryId,
  }));
}

/**
 * Birth of a category bracket: exactly what the manual draw builds today
 * (buildBracket on pre-shuffled entries — randomness stays with the caller).
 */
export function planBracketBirth(entries: BracketSeedEntry[]): {
  error: string | null;
  inserts: PlacementInsert[];
} {
  const { bracket, error } = buildBracket(entries);
  if (!bracket) {
    return { error: error ?? "Não foi possível montar a chave.", inserts: [] };
  }
  return { error: null, inserts: toPlacementInserts(bracket.matches) };
}

/** Placement runs only while the tournament has not started. */
export function canPlaceEntries(status: string) {
  return status === "published" || status === "drawn";
}

// entryOfSide/setEntryOfSide twins live at 4+ call sites each across the
// three planners below — lockstep side access (a/b) stays in one place.
function sideOf(
  match: PlacementBoardMatch,
  side: BracketSwapCoordinate["side"]
): string | null {
  return side === "a" ? match.entryAId : match.entryBId;
}

function setSideOf(
  match: PlacementBoardMatch,
  side: BracketSwapCoordinate["side"],
  value: string | null
) {
  if (side === "a") {
    match.entryAId = value;
    return;
  }
  match.entryBId = value;
}

function findRow(
  board: PlacementBoardMatch[],
  round: number,
  slotInRound: number
): PlacementBoardMatch | undefined {
  return board.find(
    (row) => row.round === round && row.slotInRound === slotInRound
  );
}

/** The parent side a first-round slot feeds: even slot → side A. */
function feedingSideOf(slotInRound: number): BracketSwapCoordinate["side"] {
  return slotInRound % 2 === 0 ? "a" : "b";
}

/** Every coordinate where the entry currently sits (placement or fed win). */
export function findBoardEntryCoordinates(
  board: PlacementBoardMatch[],
  entryId: string
): BracketSwapCoordinate[] {
  const coordinates: BracketSwapCoordinate[] = [];
  for (const row of board) {
    for (const side of ["a", "b"] as const) {
      if (sideOf(row, side) === entryId) {
        coordinates.push({
          round: row.round,
          side,
          slotInRound: row.slotInRound,
        });
      }
    }
  }
  return coordinates;
}

/** Empty first-round sides — every slot a new entry may occupy. */
export function listOpenFirstRoundSides(
  board: PlacementBoardMatch[]
): BracketSwapCoordinate[] {
  const sides: BracketSwapCoordinate[] = [];
  for (const row of board) {
    if (row.round !== 1) {
      continue;
    }
    for (const side of ["a", "b"] as const) {
      if (sideOf(row, side) === null) {
        sides.push({ round: 1, side, slotInRound: row.slotInRound });
      }
    }
  }
  return sides;
}

/**
 * Placement semantics for a rewritten ROUND-1 row: a lone entrant is the
 * draw's bye semantics (walkover resolved in place), a pair is a real match.
 * Never applies above round 1 — walkovers exist only at the bottom row.
 */
function deriveFirstRoundRowAfterFit(row: PlacementBoardMatch) {
  if (row.hasPublishedResult) {
    return;
  }
  const filled =
    (row.entryAId === null ? 0 : 1) + (row.entryBId === null ? 0 : 1);
  if (filled === 1) {
    row.status = "walkover";
    row.walkover = true;
    row.winnerEntryId = row.entryAId ?? row.entryBId;
    return;
  }
  row.status = filled === 0 ? "vacant" : "pending";
  row.walkover = false;
  row.winnerEntryId = null;
}

/**
 * Removal semantics for a rewritten ROUND-1 row (decisão 8): a lone
 * survivor is "A definir" — NEVER an automatic bye (walkover stays dead).
 */
function deriveFirstRoundRowAfterRemoval(row: PlacementBoardMatch) {
  if (row.hasPublishedResult) {
    return;
  }
  const filled =
    (row.entryAId === null ? 0 : 1) + (row.entryBId === null ? 0 : 1);
  row.status = filled === 0 ? "vacant" : "pending";
  row.walkover = false;
  row.winnerEntryId = null;
}

/**
 * Placement semantics for a rewritten row ABOVE round 1: playable or lone
 * rows are pending; a row with no sides goes vacant ONLY when both feeding
 * subtrees are dead — a live (non-vacant) feed keeps it pending, waiting
 * for the winner that will be propagated when that match resolves.
 */
function deriveAboveRoundRow(
  row: PlacementBoardMatch,
  board: PlacementBoardMatch[]
) {
  if (row.hasPublishedResult) {
    return;
  }
  const filled =
    (row.entryAId === null ? 0 : 1) + (row.entryBId === null ? 0 : 1);
  if (filled > 0) {
    row.status = "pending";
    row.walkover = false;
    row.winnerEntryId = null;
    return;
  }
  const childA = findRow(board, row.round - 1, row.slotInRound * 2);
  const childB = findRow(board, row.round - 1, row.slotInRound * 2 + 1);
  const feedAlive =
    (childA !== undefined && childA.status !== "vacant") ||
    (childB !== undefined && childB.status !== "vacant");
  row.status = feedAlive ? "pending" : "vacant";
  row.walkover = false;
  row.winnerEntryId = null;
}

/**
 * Re-derives the chain of matches ABOVE (round, slotInRound) after that row
 * changed. The feeding side of each ancestor takes the child's walkover
 * winner, or clears when the child no longer resolves (the old winner is
 * pulled back out — the same re-derivation the slot move performs). A side
 * holding an unrelated PLACEMENT (an organizer move) is never overwritten:
 * the chain flags the conflict and the caller decides (a fit filters the
 * slot out beforehand; a removal keeps the placement and re-derives only
 * the status).
 */
function deriveAncestorChain(
  board: PlacementBoardMatch[],
  patched: PlacementBoardMatch[],
  startRound: number,
  startSlotInRound: number
): { conflict: boolean } {
  let conflict = false;
  let round = startRound;
  let slotInRound = startSlotInRound;
  const topRound = Math.max(...board.map((row) => row.round));

  while (round < topRound) {
    const parent = findRow(patched, round + 1, Math.floor(slotInRound / 2));
    const child = findRow(patched, round, slotInRound);
    const oldChild = findRow(board, round, slotInRound);
    if (parent === undefined || child === undefined) {
      break;
    }
    const feedingSide = feedingSideOf(slotInRound);
    const expected = child.status === "walkover" ? child.winnerEntryId : null;
    const oldExpected =
      oldChild !== undefined && oldChild.status === "walkover"
        ? oldChild.winnerEntryId
        : null;
    const current = sideOf(parent, feedingSide);
    if (current !== expected) {
      if (current !== null && current !== oldExpected) {
        conflict = true;
      } else {
        setSideOf(parent, feedingSide, expected);
      }
    }
    deriveAboveRoundRow(parent, patched);
    round += 1;
    slotInRound = Math.floor(slotInRound / 2);
  }

  return { conflict };
}

/**
 * A first-round open side is usable when the fit cannot collide with a
 * placement parked above it: the feeding parent side must be free or hold
 * exactly the value the re-derivation is about to clear (the old bye
 * winner). Boards shaped by organizer moves can park a placement over a
 * slot — the fit then picks another open side (or the organizer re-draws).
 */
export function listUsableFirstRoundSides(
  board: PlacementBoardMatch[]
): BracketSwapCoordinate[] {
  return listOpenFirstRoundSides(board).filter((coordinate) => {
    const parent = findRow(board, 2, Math.floor(coordinate.slotInRound / 2));
    if (parent === undefined) {
      return true;
    }
    const row = findRow(
      board,
      1,
      coordinate.slotInRound
    ) as PlacementBoardMatch;
    const oldExpected = row.status === "walkover" ? row.winnerEntryId : null;
    const current = sideOf(parent, feedingSideOf(coordinate.slotInRound));
    // After the fit the child resolves to the NEW entry (lone fit) or to
    // null (pair fit) — both differ from `current` unless current is free
    // or holds the old bye winner being cleared.
    return current === null || current === oldExpected;
  });
}

function diffBoardUpdates(
  board: PlacementBoardMatch[],
  patched: PlacementBoardMatch[]
): PlacementPersistUpdate[] {
  const updates: PlacementPersistUpdate[] = [];
  for (const row of patched) {
    const before = findRow(board, row.round, row.slotInRound);
    if (before === undefined) {
      continue;
    }
    const unchanged =
      before.entryAId === row.entryAId &&
      before.entryBId === row.entryBId &&
      before.status === row.status &&
      before.walkover === row.walkover &&
      before.winnerEntryId === row.winnerEntryId;
    if (unchanged) {
      continue;
    }
    updates.push({
      bumpRowVersion: true,
      entryAId: row.entryAId,
      entryBId: row.entryBId,
      id: row.id,
      round: row.round,
      slotInRound: row.slotInRound,
      status: row.status,
      walkover: row.walkover,
      winnerEntryId: row.winnerEntryId,
    });
  }
  return updates;
}

/**
 * Fits a newly active entry into a random (injected) open first-round side.
 * The caller decides birth (empty board) and growth (no open sides) first.
 * Idempotent: an entry already on the board comes back untouched.
 */
export function planEntryFit(input: {
  board: PlacementBoardMatch[];
  entryId: string;
  pickSide: (sides: BracketSwapCoordinate[]) => BracketSwapCoordinate;
}): { error: string | null; updates: PlacementPersistUpdate[] } {
  const { board, entryId, pickSide } = input;
  if (findBoardEntryCoordinates(board, entryId).length > 0) {
    return { error: null, updates: [] };
  }
  if (listOpenFirstRoundSides(board).length === 0) {
    return { error: "A chave está cheia.", updates: [] };
  }
  const usable = listUsableFirstRoundSides(board);
  if (usable.length === 0) {
    return {
      error:
        "A chave tem ajustes manuais que impedem o encaixe automático. Sorteie a chave novamente.",
      updates: [],
    };
  }
  const chosen = pickSide(usable);
  const patched = board.map((row) => ({ ...row }));
  const row = findRow(patched, 1, chosen.slotInRound) as PlacementBoardMatch;
  setSideOf(row, chosen.side, entryId);
  deriveFirstRoundRowAfterFit(row);
  deriveAncestorChain(board, patched, 1, chosen.slotInRound);
  return { error: null, updates: diffBoardUpdates(board, patched) };
}

/**
 * Removes a cancelled entry from the board: the entry disappears from every
 * row it occupies (placements AND fed sides) and the affected columns are
 * re-derived WITHOUT new byes (decisão 8) — a lone survivor stays "A
 * definir", a dead walkover row goes vacant, and the propagated win is
 * pulled out of the parent side. Idempotent: an entry not on the board is a
 * no-op.
 */
export function planEntryRemoval(input: {
  board: PlacementBoardMatch[];
  entryId: string;
}): { updates: PlacementPersistUpdate[] } {
  const { board, entryId } = input;
  const coordinates = findBoardEntryCoordinates(board, entryId);
  if (coordinates.length === 0) {
    return { updates: [] };
  }
  const patched = board.map((row) => ({ ...row }));
  const touched = new Map<string, { round: number; slotInRound: number }>();
  for (const coordinate of coordinates) {
    const row = findRow(
      patched,
      coordinate.round,
      coordinate.slotInRound
    ) as PlacementBoardMatch;
    setSideOf(row, coordinate.side, null);
    if (coordinate.round === 1) {
      deriveFirstRoundRowAfterRemoval(row);
    } else {
      deriveAboveRoundRow(row, patched);
    }
    touched.set(`${coordinate.round}:${coordinate.slotInRound}`, {
      round: coordinate.round,
      slotInRound: coordinate.slotInRound,
    });
  }
  for (const slot of touched.values()) {
    deriveAncestorChain(board, patched, slot.round, slot.slotInRound);
  }
  return { updates: diffBoardUpdates(board, patched) };
}

/**
 * Grows a FULL bracket one power of two by inserting a new first round
 * below: every existing row moves up one round (pairs preserved verbatim —
 * schedules stay attached to the same pair), and every current entrant
 * descends into its own new round-1 row as a resolved bye (walkover), so a
 * grown bracket stays startable. The caller persists updates TOP-DOWN
 * (descending round) to respect the (categoryId, round, slotInRound) unique
 * index while the old rows still occupy their previous coordinates.
 */
export function planBracketGrowth(input: { board: PlacementBoardMatch[] }): {
  error: string | null;
  inserts: PlacementInsert[];
  updates: PlacementPersistUpdate[];
} {
  const { board } = input;
  if (board.length === 0) {
    return { error: "A chave ainda não existe.", inserts: [], updates: [] };
  }
  if (listOpenFirstRoundSides(board).length > 0) {
    return {
      error: "A chave ainda tem vagas em aberto.",
      inserts: [],
      updates: [],
    };
  }

  const firstRound = board
    .filter((row) => row.round === 1)
    .sort((a, b) => a.slotInRound - b.slotInRound);
  const entrants: string[] = [];
  for (const row of firstRound) {
    for (const side of ["a", "b"] as const) {
      const entryId = sideOf(row, side);
      if (entryId !== null) {
        entrants.push(entryId);
      }
    }
  }

  const updates: PlacementPersistUpdate[] = board.map((row) => ({
    bumpRowVersion: false,
    entryAId: row.entryAId,
    entryBId: row.entryBId,
    id: row.id,
    round: row.round + 1,
    slotInRound: row.slotInRound,
    status: row.status,
    walkover: row.walkover,
    winnerEntryId: row.winnerEntryId,
  }));

  const inserts: PlacementInsert[] = entrants.map((entryId, index) => ({
    entryAId: entryId,
    entryBId: null,
    round: 1,
    slotInRound: index,
    status: "walkover",
    walkover: true,
    winnerEntryId: entryId,
  }));

  return { error: null, inserts, updates };
}
