/**
 * Incremental bracket placement: while the tournament has NOT started, the bracket
 * mirrors the entries — a newly `active` entry fits a RANDOM open first-round side
 * (injected pick, no bye re-derivation), and a cancellation leaves its slot EMPTY
 * ("A definir"), never an automatic walkover. A full bracket GROWS one power of two
 * by inserting a new first round BELOW (pairs preserved, each entrant descending as
 * a resolved bye, so the bracket stays startable). Pure rules: Convex-free.
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

export type PlacementInsert = {
  entryAId: string | null;
  entryBId: string | null;
  round: number;
  slotInRound: number;
  status: SwapMatchStatus;
  walkover: boolean;
  winnerEntryId: string | null;
};

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

/** Birth of a category bracket: what the manual draw builds (randomness stays with the caller). */
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

// Side access (a/b) twins: 4+ call sites each across the planners below.
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

/** A lone entrant in the first round resolves as the draw's bye (walkover); never above it. */
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

/** A lone survivor stays "A definir" — removal NEVER hands an automatic bye. */
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
 * Above the first round: a row with no sides goes vacant ONLY when both feeding
 * subtrees are dead — a live feed keeps it pending, waiting for that winner.
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
 * Re-derives the chain above (round, slotInRound) after that row changed: each
 * ancestor's feeding side takes the child's walkover winner or clears the old winner
 * when the child no longer resolves. A side holding an unrelated PLACEMENT (organizer
 * move) is never overwritten — the chain flags the conflict and the caller decides.
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
 * An open side is usable when the fit cannot collide with a placement parked above:
 * the parent side must be free or hold the old bye winner the re-derivation clears —
 * organizer-moved boards can park a placement over a slot, so the fit picks another.
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
    // After the fit the child resolves to the new entry (lone) or null (pair) —
    // both differ from `current` unless it is free or holds the old bye winner.
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
 * Fits a newly active entry into a random open first-round side; the caller decides
 * birth/growth first. Idempotent: an entry already on the board comes back untouched.
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
 * Removes a cancelled entry from every row it occupies (placements AND fed sides) and
 * re-derives the columns WITHOUT new byes: a lone survivor stays "A definir", a dead
 * walkover row goes vacant, the propagated win is pulled out of the parent. Idempotent.
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
 * Grows a FULL bracket one power of two by inserting a new first round below: existing
 * rows move up one round (pairs preserved — schedules stay attached to the same pair)
 * and each entrant descends into its own new round-1 row as a resolved bye. The caller
 * persists updates TOP-DOWN to respect the (categoryId, round, slotInRound) unique index.
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
