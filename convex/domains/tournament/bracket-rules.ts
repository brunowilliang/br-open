/**
 * Pure single-elimination bracket rules (IBX-0010 slice 2).
 *
 * All functions are deterministic and Convex-free so they can be unit-tested
 * directly. Randomness is injected by the caller: the mutation shuffles
 * non-seeded entries BEFORE calling `buildBracket`.
 */

export type BracketSeedEntry = {
  entryId: string;
  seedRank: number | null;
  /**
   * IBX-0035 (PLN-0004): round where the entry enters the bracket.
   * null/1 = round 1 (today's behavior). entryRound >= 2 is a direct
   * entry: the head of seed skips earlier rounds and occupies its standard
   * seed side-slot at the entry round.
   */
  entryRound?: number | null;
};

export type BracketSlot = {
  entryId: string | null;
  seedRank: number | null;
};

export type BuiltBracketMatch = {
  entryAId: string | null;
  entryBId: string | null;
  /** True when one side is missing at draw time (1st round only). */
  isBye: boolean;
  /** True when the whole subtree feeding this match is pruned by direct entries (no sides ever). */
  isVacant: boolean;
  round: number;
  slotInRound: number;
  /** Resolved at draw time for bye matches (winner advances immediately). */
  winnerEntryId: string | null;
};

export type BuiltBracket = {
  matches: BuiltBracketMatch[];
  roundCount: number;
  totalSlots: number;
};

/** Next power of two >= value (minimum 2 — a bracket needs a final). */
export function nextBracketSize(entryCount: number) {
  let size = 2;
  while (size < entryCount) {
    size *= 2;
  }
  return size;
}

/**
 * Classic tournament seeding order for a bracket of `bracketSize` slots:
 * `order[i]` is the seed number that belongs at slot `i`. Slot `i` plays
 * slot `i ^ 1` in round 1 (XOR — adjacent pairs). Seeds 1 and 2 can only
 * meet in the final, seeds 1–4 in the semis, and so on.
 *
 * bracketSize 8 → [1, 8, 4, 5, 2, 7, 3, 6]
 */
export function seedOrder(bracketSize: number): number[] {
  let order = [1, 2];
  let size = 2;
  while (size < bracketSize) {
    size *= 2;
    const next: number[] = [];
    for (const seed of order) {
      next.push(seed, size + 1 - seed);
    }
    order = next;
  }
  return order;
}

export function slotOfSeed(bracketSize: number, seedRank: number) {
  return seedOrder(bracketSize).indexOf(seedRank);
}

/**
 * Validates seed ranks before drawing: present seeds must be exactly
 * 1..s with no gaps or duplicates (the organizer marks heads of seed in
 * order via the UI, but the rule defends against stale payloads).
 */
export function validateSeedRanks(entries: BracketSeedEntry[]) {
  const ranks = entries
    .map((entry) => entry.seedRank)
    .filter((rank): rank is number => rank !== null)
    .sort((a, b) => a - b);

  for (const [index, rank] of ranks.entries()) {
    if (rank !== index + 1) {
      return "Os cabeças de chave precisam ser 1, 2, 3… sem buracos.";
    }
  }
  return null;
}

/**
 * IBX-0037: draw (and re-draw) eligibility. `published` = first draw;
 * `drawn` = re-draw — the organizer may re-sort after adjusting seeds or
 * entry phases (nothing has a published result yet, so delete + rebuild is
 * safe). `ongoing` never re-draws (bracket with results is untouchable).
 */
export function canDrawTournament(status: string) {
  return status === "published" || status === "drawn";
}

/**
 * IBX-0035 (PLN-0004): validates direct phase entries before drawing.
 *
 * A direct entry (entryRound >= 2) is a head-of-seed privilege — the draw
 * places it via slotOfSeed projected to the entry round, so it requires a
 * seed. Completability: every round skipped consumes 2^(r-1) - 1 of the
 * forced byes (drawSize - entryCount), and the pruned round-1 blocks of
 * the direct entries must be PAIRWISE DISJOINT (review C1/H1) — the budget
 * counts the blocks as disjoint regions, and an overlap (a phase contained
 * inside another's region) would leave a match with a dead feeding subtree
 * and the bracket could never finish.
 */
export function validateEntryRounds(entries: BracketSeedEntry[]) {
  const drawSize = nextBracketSize(entries.length);
  const roundCount = Math.log2(drawSize);
  const blocks: Array<{ end: number; start: number }> = [];
  let skipCost = 0;

  for (const entry of entries) {
    const round = entry.entryRound ?? 1;
    if (round === 1) {
      continue;
    }
    if (!Number.isInteger(round) || round < 2) {
      return "Fase de entrada inválida.";
    }
    if (!entry.seedRank) {
      return "Avanço de fase é exclusivo de cabeças de chave.";
    }
    if (round > roundCount) {
      return "A fase de entrada escolhida não existe nessa chave.";
    }
    const blockSize = 2 ** (round - 1);
    const sideSlot = Math.floor(
      slotOfSeed(drawSize, entry.seedRank) / blockSize
    );
    const start = sideSlot * blockSize;
    blocks.push({ end: start + blockSize, start });
    skipCost += blockSize - 1;
  }

  for (const [index, block] of blocks.entries()) {
    for (const other of blocks.slice(index + 1)) {
      if (block.start < other.end && other.start < block.end) {
        if (block.start === other.start && block.end === other.end) {
          return "Dois cabeças de chave disputam a mesma vaga na fase de entrada. Ajuste as fases deles.";
        }
        return "Uma entrada direta está dentro da região de outra na chave. Ajuste as fases delas.";
      }
    }
  }

  if (skipCost > drawSize - entries.length) {
    return "Os avanços de fase excedem as vagas livres da chave.";
  }
  return null;
}

/**
 * Builds the full bracket from draw-ready entries.
 *
 * `entries` must be pre-shuffled by the caller EXCEPT that seeding
 * placement ignores input order (seeds go to their standard slots). Byes
 * are assigned to the pairs of the top seeds first (spec: byes are
 * prioritized for heads of seed), then to pairs by their best seed.
 */
export function buildBracket(
  entries: BracketSeedEntry[]
): { bracket: BuiltBracket; error: null } | { bracket: null; error: string } {
  if (entries.length < 2) {
    return {
      bracket: null,
      error: "A chave precisa de pelo menos 2 inscrições.",
    };
  }

  const seedError = validateSeedRanks(entries);
  if (seedError) {
    return { bracket: null, error: seedError };
  }

  const entryRoundError = validateEntryRounds(entries);
  if (entryRoundError) {
    return { bracket: null, error: entryRoundError };
  }

  const totalSlots = nextBracketSize(entries.length);
  const roundCount = Math.log2(totalSlots);
  const seedNumbers = seedOrder(totalSlots);
  const slots: BracketSlot[] = Array.from({ length: totalSlots }, () => ({
    entryId: null,
    seedRank: null,
  }));

  // 1. Direct entries claim the standard side-slot of their seed AT the
  // entry round (slotOfSeed projected up the tree). Two claims on the same
  // side-slot mean those heads would meet before that round — impossible
  // placement.
  const directEntries = entries
    .filter((entry) => (entry.entryRound ?? 1) >= 2)
    .sort((a, b) => (a.seedRank ?? 0) - (b.seedRank ?? 0));
  const claimByRoundSideSlot = new Map<string, string>();
  for (const entry of directEntries) {
    const round = entry.entryRound as number;
    const sideSlot = Math.floor(
      slotOfSeed(totalSlots, entry.seedRank as number) / 2 ** (round - 1)
    );
    const key = `${round}:${sideSlot}`;
    if (claimByRoundSideSlot.has(key)) {
      return {
        bracket: null,
        error:
          "Dois cabeças de chave disputam a mesma vaga na fase de entrada. Ajuste as fases deles.",
      };
    }
    claimByRoundSideSlot.set(key, entry.entryId);
  }

  // 2. Round-1 slots consumed by pruned subtrees: the whole region feeding
  // a claimed side-slot. Rows there persist as VACANT matches (no sides,
  // no winner) so the emitted grid stays complete for the layout.
  const prunedSlot = new Array<boolean>(totalSlots).fill(false);
  for (const key of claimByRoundSideSlot.keys()) {
    const [round, sideSlot] = key.split(":").map(Number);
    const blockSize = 2 ** (round - 1);
    const blockStart = sideSlot * blockSize;
    for (let slot = blockStart; slot < blockStart + blockSize; slot += 1) {
      prunedSlot[slot] = true;
    }
  }

  // 3. Round-1 seeds occupy their standard slots (higher seeds first). A
  // seed kept on round 1 whose region was absorbed by a direct entry has
  // no standard position left — the organizer must advance it or unseed
  // it (surfaced as a draw error).
  const roundOneSeeds = entries
    .filter((entry) => entry.seedRank !== null && (entry.entryRound ?? 1) < 2)
    .sort((a, b) => (a.seedRank ?? 0) - (b.seedRank ?? 0));
  for (const entry of roundOneSeeds) {
    const slot = slotOfSeed(totalSlots, entry.seedRank as number);
    if (prunedSlot[slot]) {
      return {
        bracket: null,
        error:
          "Um cabeça de chave da 1ª rodada ficou sem posição: avance a fase dele ou desmarque o seed.",
      };
    }
    slots[slot] = { entryId: entry.entryId, seedRank: entry.seedRank };
  }

  // 4. Bye slots — live (unpruned) free slots with the weakest standard
  // seed numbers, at most one per 1st-round pair. Classic construction
  // preserved: with no direct entries this is exactly "slots whose
  // standard seed number exceeds the entry count" (byes opposite the top
  // seeds, H1). Each direct entry consumes 2^(r-1) - 1 of the forced byes.
  const byeCount =
    totalSlots -
    entries.length -
    directEntries.reduce(
      (sum, entry) => sum + 2 ** ((entry.entryRound ?? 1) - 1) - 1,
      0
    );
  const byeSlots = new Set<number>();
  const byePairTaken = new Set<number>();
  const slotsByWeakness = Array.from(
    { length: totalSlots },
    (_, slot) => slot
  ).sort((a, b) => seedNumbers[b] - seedNumbers[a]);
  for (const slot of slotsByWeakness) {
    if (byeSlots.size >= byeCount) {
      break;
    }
    if (prunedSlot[slot] || slots[slot].entryId !== null) {
      continue;
    }
    const pair = Math.floor(slot / 2);
    if (byePairTaken.has(pair)) {
      continue;
    }
    byeSlots.add(slot);
    byePairTaken.add(pair);
  }

  // 5. Non-seeded entries fill the remaining live free slots (never bye
  // slots) in caller order — the caller shuffles for randomness.
  const nonSeeded = entries.filter((entry) => entry.seedRank === null);
  const freeSlotIterator = slots
    .map((occupancy, slot) =>
      occupancy.entryId === null && !byeSlots.has(slot) && !prunedSlot[slot]
        ? slot
        : -1
    )
    .filter((slot) => slot >= 0)
    [Symbol.iterator]();
  for (const entry of nonSeeded) {
    const slot = freeSlotIterator.next();
    if (slot.done) {
      return { bracket: null, error: "Não foi possível montar a chave." };
    }
    slots[slot.value] = { entryId: entry.entryId, seedRank: null };
  }

  // 6. Emit matches round by round. A side-slot is LIVE when claimed by a
  // direct entry, when it hosts a round-1 player/bye, or when fed by a
  // live child; a match whose two feeding side-slots are dead is VACANT.
  // Round-1 byes resolve immediately (walkover with winner) and feed the
  // next round.
  const sideSlotIsLive = (round: number, sideSlot: number): boolean => {
    if (claimByRoundSideSlot.has(`${round}:${sideSlot}`)) {
      return true;
    }
    if (round === 1) {
      return !prunedSlot[sideSlot];
    }
    return (
      sideSlotIsLive(round - 1, 2 * sideSlot) ||
      sideSlotIsLive(round - 1, 2 * sideSlot + 1)
    );
  };

  const matches: BuiltBracketMatch[] = [];
  const winnerByRoundSlot = new Map<string, string>();

  for (let round = 1; round <= roundCount; round += 1) {
    const matchesInRound = totalSlots / 2 ** round;
    for (let slotInRound = 0; slotInRound < matchesInRound; slotInRound += 1) {
      const entryForSide = (sideSlot: number): string | null => {
        const claim = claimByRoundSideSlot.get(`${round}:${sideSlot}`);
        if (claim) {
          return claim;
        }
        if (round === 1) {
          return slots[sideSlot].entryId;
        }
        return winnerByRoundSlot.get(`${round - 1}:${sideSlot}`) ?? null;
      };

      const entryAId = entryForSide(2 * slotInRound);
      const entryBId = entryForSide(2 * slotInRound + 1);
      const isVacant = !(
        sideSlotIsLive(round, 2 * slotInRound) ||
        sideSlotIsLive(round, 2 * slotInRound + 1)
      );
      const isBye =
        round === 1 && !isVacant && (entryAId === null || entryBId === null);
      const winnerEntryId = isBye ? (entryAId ?? entryBId) : null;

      if (winnerEntryId !== null) {
        winnerByRoundSlot.set(`${round}:${slotInRound}`, winnerEntryId);
      }

      matches.push({
        entryAId,
        entryBId,
        isBye,
        isVacant,
        round,
        slotInRound,
        winnerEntryId,
      });
    }
  }

  return { bracket: { matches, roundCount, totalSlots }, error: null };
}

export function getFinalRoundMatch(bracket: BuiltBracket) {
  return bracket.matches.find(
    (match) => match.round === bracket.roundCount
  ) as BuiltBracketMatch;
}

/**
 * A category is finished when its final has a winner (champion).
 */
export function isBracketFinished(bracket: BuiltBracket) {
  return getFinalRoundMatch(bracket).winnerEntryId !== null;
}

// ---------------------------------------------------------------------------
// Slot move (IBX-0035 generalized the same-round swap to any round; IBX-0053
// opens the CROSS-ROUND move of seeds/heads). The rules read the WHOLE
// category board — not one round — because whether a side may move depends on
// how its occupant arrived: a placement moves, a propagated win does not.
// The move PERMUTES the values of the two clicked sides: an empty destination
// leaves the origin empty, an occupied one transposes the two entries (never
// discard the displaced entry — the count entrants x slots is an invariant).
// ---------------------------------------------------------------------------

export type BracketMatchSide = "a" | "b";

export type SwapMatchStatus =
  | "pending"
  | "scheduled"
  | "vacant"
  | "walkover"
  | "finished";

/** Coordinate of one bracket side: the round, the match in it, the side. */
export type BracketSwapCoordinate = {
  round: number;
  side: BracketMatchSide;
  slotInRound: number;
};

/**
 * Board row the move rules read. `walkover` is the draw-time bye (a lone side
 * that advanced without playing); `winnerEntryId` is the decided win that
 * feeds the parent match.
 */
export type SwapBoardMatch = {
  entryAId: string | null;
  entryBId: string | null;
  /** Published (organizer-entered) result — locks the row. */
  hasPublishedResult: boolean;
  id: string;
  round: number;
  slotInRound: number;
  status: SwapMatchStatus;
  walkover: boolean;
  winnerEntryId: string | null;
};

/** A move: permute the two clicked sides (same round or cross-round). */
export type BracketSwapMove = {
  board: SwapBoardMatch[];
  from: BracketSwapCoordinate;
  to: BracketSwapCoordinate;
};

/** Row the procedure rewrites after a move (the agenda dies on all of them). */
export type SwapPersistUpdate = {
  /** Feed rows (pushed/retired win) bump the row version; swapped ones don't. */
  bumpRowVersion: boolean;
  entryAId: string | null;
  entryBId: string | null;
  id: string;
  status: SwapMatchStatus;
  walkover: boolean;
  winnerEntryId: string | null;
};

function entryOfSide(
  match: { entryAId: string | null; entryBId: string | null },
  side: BracketMatchSide
): string | null {
  return side === "a" ? match.entryAId : match.entryBId;
}

function setEntryOfSide(
  match: SwapBoardMatch,
  side: BracketMatchSide,
  entryId: string | null
) {
  if (side === "a") {
    match.entryAId = entryId;
    return;
  }
  match.entryBId = entryId;
}

function findBoardMatch(
  board: SwapBoardMatch[],
  round: number,
  slotInRound: number
) {
  return board.find(
    (match) => match.round === round && match.slotInRound === slotInRound
  );
}

/**
 * Status a rewritten match ends up with. Published results are explicit state
 * and are preserved verbatim (a move is blocked when one exists, but the rule
 * must never derive over one). A row with no sides left is vacant. Only a row
 * that ALREADY was a bye keeps advancing by walkover (the draw's bye is
 * re-derived with its survivor: moving a bye's head keeps the bye shape at
 * round 1). Any other lone side is "A definir" — pending, no auto-win: the
 * move NEVER hands a walkover to the opponent of the moved entry, and from
 * round 2 on a lone side is a match waiting for the feed, not a bye
 * (`buildBracket` only ever makes round-1 byes). BUG-0028: the schedule dies
 * with the pair, so `scheduled` never survives a move (the caller clears the
 * booking).
 */
export function deriveSwapMatchStatus(input: {
  entryAId: string | null;
  entryBId: string | null;
  hasPublishedResult: boolean;
  originalStatus: SwapMatchStatus;
}): SwapMatchStatus {
  if (input.hasPublishedResult) {
    return input.originalStatus;
  }
  const filled =
    (input.entryAId === null ? 0 : 1) + (input.entryBId === null ? 0 : 1);
  if (filled === 0) {
    return "vacant";
  }
  if (input.originalStatus === "walkover" && filled === 1) {
    return "walkover";
  }
  return "pending";
}

/**
 * Derives a rewritten row's status, bye flag and decided winner in place. The
 * row's own status is the marker of the draw's bye: deriving twice is
 * idempotent (a "walkover" stays "walkover" while it keeps one side).
 */
function deriveRewrittenMatch(match: SwapBoardMatch) {
  if (match.hasPublishedResult) {
    return;
  }
  const status = deriveSwapMatchStatus({
    entryAId: match.entryAId,
    entryBId: match.entryBId,
    hasPublishedResult: match.hasPublishedResult,
    originalStatus: match.status,
  });
  match.status = status;
  match.walkover = status === "walkover";
  match.winnerEntryId =
    status === "walkover" ? (match.entryAId ?? match.entryBId) : null;
}

/**
 * IBX-0053/BUG-0034: a side is DERIVED when its occupant is not a placement
 * but the WIN of the match that feeds it — the child already resolved a winner
 * (draw-time bye or published result) and it was propagated up. A derived side
 * has no placement of its own, so `resolveMoveCoordinate` descends to the side
 * that really holds the entry before the move permutes anything. What locks a
 * derived side for good is the ORIGIN of the win: a win that came from a
 * published (played) result is not re-derivable and the move is refused; the
 * draw's bye is re-derived with its new survivor (spec: "byes re-deriváveis",
 * BUG-0034). Placements stay movable — a draw entry, a direct phase entry, an
 * entry the organizer moved there. The round-1 bye's own side is a placement
 * of the draw, not a derivation.
 */
export function swapSideIsDerived(
  board: SwapBoardMatch[],
  coordinate: BracketSwapCoordinate
) {
  const match = findBoardMatch(board, coordinate.round, coordinate.slotInRound);
  const entryId = match ? entryOfSide(match, coordinate.side) : null;
  if (!match || entryId === null || match.round <= 1) {
    return false;
  }
  const child = findBoardMatch(
    board,
    match.round - 1,
    coordinate.slotInRound * 2 + (coordinate.side === "a" ? 0 : 1)
  );
  return child?.winnerEntryId === entryId;
}

/** The side's win came from a PLAYED match — nothing to re-derive. */
const DERIVED_SIDE_LOCKED =
  "Essa vaga vem de um confronto já decidido e não pode ser ajustada.";

/**
 * BUG-0034: the PLACEMENT the clicked side really moves. Descends the feed
 * chain while the side is derived (its occupant is the child's win) until it
 * reaches the side that holds the entry, so a move clicked on a bye's
 * propagated side — the quarterfinal card that shows a player who received a
 * bye at the draw — permutes the two ENTRIES and lets the caller persist the
 * re-derived bye and advance. A link decided by a PUBLISHED result is not
 * re-derivable: the played match is untouchable and the error comes back
 * (same message as before, still BAD_REQUEST at the procedure).
 */
export function resolveMoveCoordinate(
  board: SwapBoardMatch[],
  coordinate: BracketSwapCoordinate
): { coordinate: BracketSwapCoordinate; error: string | null } {
  let current = coordinate;

  for (;;) {
    if (!swapSideIsDerived(board, current)) {
      return { coordinate: current, error: null };
    }
    const match = findBoardMatch(
      board,
      current.round,
      current.slotInRound
    ) as SwapBoardMatch;
    const entryId = entryOfSide(match, current.side);
    const child = findBoardMatch(
      board,
      current.round - 1,
      current.slotInRound * 2 + (current.side === "a" ? 0 : 1)
    ) as SwapBoardMatch;
    if (child.hasPublishedResult) {
      return { coordinate: current, error: DERIVED_SIDE_LOCKED };
    }
    if (child.entryAId !== entryId && child.entryBId !== entryId) {
      return { coordinate: current, error: DERIVED_SIDE_LOCKED };
    }
    current = {
      round: child.round,
      side: child.entryAId === entryId ? "a" : "b",
      slotInRound: child.slotInRound,
    };
  }
}

/**
 * IBX-0068: the bracket is an EDITABLE preview only while `drawn` — starting
 * the tournament FREEZES it. The same-round move in `ongoing` (IBX-0053,
 * 16/09) is EXTINCT: results and scheduling remain, positions no longer move.
 */
export function validateSwapWindow(input: { status: string }) {
  if (input.status === "drawn") {
    return null;
  }
  return "O chaveamento foi congelado no início do torneio.";
}

/**
 * Feed writes the move implies. A rewritten match that ends as a resolved bye
 * pushes its winner into the parent's feeding side; one that lost its bye
 * pulls the old win back out (moving a decided side away retires the
 * propagated winner). A write is only legal over the win of THIS match —
 * anything else is a placement the move must not overwrite — and the parent
 * must not carry a published result.
 */
function writeSwapFeed(input: {
  board: SwapBoardMatch[];
  patched: SwapBoardMatch[];
  rewritten: SwapBoardMatch[];
}): { error: string | null; rewritten: SwapBoardMatch[] } {
  const rewritten = new Map(input.rewritten.map((match) => [match.id, match]));

  for (const match of input.rewritten) {
    const before = findBoardMatch(
      input.board,
      match.round,
      match.slotInRound
    ) as SwapBoardMatch;
    if (match.winnerEntryId === before.winnerEntryId) {
      continue;
    }
    const parentCoordinates = nextMatchCoordinates(
      match.round,
      match.slotInRound
    );
    const parent = findBoardMatch(
      input.patched,
      parentCoordinates.round,
      parentCoordinates.slotInRound
    );
    if (!parent) {
      continue;
    }
    // A child at an even slot feeds side A of its parent, an odd slot side B
    // (the draw's propagation convention).
    const side: BracketMatchSide = match.slotInRound % 2 === 0 ? "a" : "b";
    const placed = entryOfSide(parent, side);
    if (placed === match.winnerEntryId) {
      continue;
    }
    if (placed !== null && placed !== before.winnerEntryId) {
      return {
        error: "Esse ajuste moveria um vencedor para uma vaga já ocupada.",
        rewritten: [],
      };
    }
    if (parent.hasPublishedResult) {
      return {
        error:
          "A rodada seguinte já tem resultado publicado: o vencedor não pode mudar.",
        rewritten: [],
      };
    }
    setEntryOfSide(parent, side, match.winnerEntryId);
    deriveRewrittenMatch(parent);
    rewritten.set(parent.id, parent);
  }

  // Second pass, over the board the writes above produced: a rewritten row
  // that ends with TWO sides becomes playable, and its winner will be written
  // over whatever occupies the parent's feeding side when the result is
  // published (matches.ts propagates the side without checking occupancy).
  // The draw only ever leaves that side free for a playable row — a direct
  // entry PRUNES the whole subtree below it — so COMPLETING a pruned row
  // through moves (filling its second side) would drop the entry held above,
  // e.g. the direct entry itself.
  for (const match of input.rewritten) {
    const playsBoth =
      entryOfSide(match, "a") !== null && entryOfSide(match, "b") !== null;
    if (!playsBoth) {
      continue;
    }
    const parentCoordinates = nextMatchCoordinates(
      match.round,
      match.slotInRound
    );
    const parent = findBoardMatch(
      input.patched,
      parentCoordinates.round,
      parentCoordinates.slotInRound
    );
    // A child at an even slot feeds side A of its parent, an odd slot side B.
    const side: BracketMatchSide = match.slotInRound % 2 === 0 ? "a" : "b";
    if (parent && entryOfSide(parent, side) !== null) {
      return {
        error: "Esse ajuste moveria um vencedor para uma vaga já ocupada.",
        rewritten: [],
      };
    }
  }

  return { error: null, rewritten: [...rewritten.values()] };
}

/**
 * Single source of the move: static checks, the descent from a derived side to
 * the placement it moves (BUG-0034), the permutation, the re-derived status of
 * both rewritten rows and the feed writes. `resolved` carries the coordinates
 * actually permuted (the clicked ones when nothing was derived), so the
 * persist plan can tell the rewritten rows from the fed ones. On error the
 * board comes back UNTOUCHED — no caller may persist a half-applied move.
 */
function planSwap(move: BracketSwapMove): {
  error: string | null;
  patched: SwapBoardMatch[];
  resolved: { from: BracketSwapCoordinate; to: BracketSwapCoordinate };
} {
  const { board, from, to } = move;
  const untouched = () => board.map((match) => ({ ...match }));
  const rejected = (error: string) => ({
    error,
    patched: untouched(),
    resolved: { from, to },
  });
  const matchFrom = findBoardMatch(board, from.round, from.slotInRound);
  const matchTo = findBoardMatch(board, to.round, to.slotInRound);

  if (
    from.round === to.round &&
    from.slotInRound === to.slotInRound &&
    from.side === to.side
  ) {
    return rejected("Escolha duas posições diferentes.");
  }
  if (!(matchFrom && matchTo)) {
    return rejected("Posição inválida na chave.");
  }

  for (const match of [matchFrom, matchTo]) {
    if (match.hasPublishedResult) {
      return rejected(
        "Esse confronto já tem resultado publicado e não pode ser ajustado."
      );
    }
  }

  // The move permutes exactly the entry the organizer clicked: a free side
  // has nothing to move.
  if (entryOfSide(matchFrom, from.side) === null) {
    return rejected("Escolha uma posição preenchida para trocar.");
  }

  // An empty side only accepts an entry when nothing can land there first:
  // round 1 (no feed) or a side fed by a pruned (vacant) row. A side waiting
  // for a LIVE feed would be overwritten when that match publishes its winner
  // (matches.ts writes the side without checking occupancy) and the moved
  // entry would vanish from the bracket.
  const destinationFeedIsDead =
    to.round <= 1 ||
    findBoardMatch(
      board,
      to.round - 1,
      to.slotInRound * 2 + (to.side === "a" ? 0 : 1)
    )?.status === "vacant";
  if (entryOfSide(matchTo, to.side) === null && !destinationFeedIsDead) {
    return rejected(
      "Essa vaga ainda vai receber o vencedor do confronto de baixo — só uma linha podada aceita uma inscrição."
    );
  }

  // A side whose occupant came from the child's win has no placement of its
  // own: the move descends to the side that holds the entry, and the bye /
  // advance is re-derived from there.
  const resolvedFrom = resolveMoveCoordinate(board, from);
  if (resolvedFrom.error) {
    return rejected(resolvedFrom.error);
  }
  const resolvedTo = resolveMoveCoordinate(board, to);
  if (resolvedTo.error) {
    return rejected(resolvedTo.error);
  }
  const placementFrom = resolvedFrom.coordinate;
  const placementTo = resolvedTo.coordinate;

  if (
    placementFrom.round === placementTo.round &&
    placementFrom.slotInRound === placementTo.slotInRound &&
    placementFrom.side === placementTo.side
  ) {
    return rejected("Escolha duas posições diferentes.");
  }

  const matchPlacementFrom = findBoardMatch(
    board,
    placementFrom.round,
    placementFrom.slotInRound
  ) as SwapBoardMatch;
  const matchPlacementTo = findBoardMatch(
    board,
    placementTo.round,
    placementTo.slotInRound
  ) as SwapBoardMatch;
  for (const match of [matchPlacementFrom, matchPlacementTo]) {
    if (match.hasPublishedResult) {
      return rejected(
        "Esse confronto já tem resultado publicado e não pode ser ajustado."
      );
    }
  }

  const patched = untouched();
  const patchedFrom = findBoardMatch(
    patched,
    placementFrom.round,
    placementFrom.slotInRound
  ) as SwapBoardMatch;
  const patchedTo = findBoardMatch(
    patched,
    placementTo.round,
    placementTo.slotInRound
  ) as SwapBoardMatch;
  const fromEntry = entryOfSide(matchPlacementFrom, placementFrom.side);
  setEntryOfSide(
    patchedFrom,
    placementFrom.side,
    entryOfSide(matchPlacementTo, placementTo.side)
  );
  setEntryOfSide(patchedTo, placementTo.side, fromEntry);
  deriveRewrittenMatch(patchedFrom);
  deriveRewrittenMatch(patchedTo);

  const feed = writeSwapFeed({
    board,
    patched,
    rewritten:
      patchedFrom === patchedTo ? [patchedFrom] : [patchedFrom, patchedTo],
  });
  if (feed.error) {
    return rejected(feed.error);
  }
  return {
    error: null,
    patched,
    resolved: { from: placementFrom, to: placementTo },
  };
}

/**
 * Move validation. `status` is the tournament status and only matters for the
 * window (`drawn` only — IBX-0068: the bracket freezes on start); the
 * procedure gates `drawn` before calling. Errors are BAD_REQUEST material
 * with specific messages.
 */
export function validateSlotSwap(input: {
  board: SwapBoardMatch[];
  from: BracketSwapCoordinate;
  status: string;
  to: BracketSwapCoordinate;
}) {
  return (
    validateSwapWindow({ status: input.status }) ??
    planSwap({ board: input.board, from: input.from, to: input.to }).error
  );
}

/**
 * IBX-0038 (review C1): move authorization. `getManagedTournamentOrThrow` only
 * proves ownership of the tournamentId it receives — the moved category must
 * be proven to belong to that same tournament, otherwise an organizer of
 * tournament A could shuffle tournament B's bracket through a forged
 * categoryId.
 */
export function validateSwapCategoryOwnership(input: {
  categoryTournamentId: string;
  tournamentId: string;
}): string | null {
  return input.categoryTournamentId === input.tournamentId
    ? null
    : "Categoria não encontrada nesse torneio.";
}

/**
 * Pure move over the board: byes are re-derived at round 1, the fed win is
 * pushed or retired at any round (IBX-0053). The caller validates the move
 * first; an invalid one comes back UNCHANGED.
 */
export function applySlotSwap(move: BracketSwapMove) {
  return planSwap(move).patched;
}

/**
 * Rows the procedure must persist after a validated move: the two rewritten
 * matches (already with their derived status/bye/winner) plus every feed row
 * whose win changed. Untouched matches — scheduled ones included — stay out,
 * so the agenda only dies with the pairs the move actually rewrote
 * (BUG-0028). `affectedEntryIds` carries the players to notify: both clicked
 * sides and whoever lost the position a feed write emptied.
 */
export function buildSwapPersistPlan(move: BracketSwapMove) {
  const plan = planSwap(move);
  const patched = plan.patched;
  // BUG-0034: the rows the organizer's click permuted are the PLACEMENTS the
  // move descended to — a side derived from a bye moves the entry at the child
  // that holds it, so the clicked row is a fed one here (bumps its version).
  const swappedIds = new Set(
    [plan.resolved.from, plan.resolved.to]
      .map(
        (coordinate) =>
          findBoardMatch(move.board, coordinate.round, coordinate.slotInRound)
            ?.id
      )
      .filter((id): id is string => id !== undefined)
  );
  const updates: SwapPersistUpdate[] = [];
  const affectedEntryIds = new Set<string>();

  for (const row of patched) {
    const before = findBoardMatch(move.board, row.round, row.slotInRound);
    if (!before) {
      continue;
    }
    // Both clicked players are notified; a feed row notifies whoever lost the
    // side the move emptied (the retired winner).
    const swapped = swappedIds.has(row.id);
    for (const entryId of [before.entryAId, before.entryBId]) {
      if (entryId === null) {
        continue;
      }
      if (swapped || (entryId !== row.entryAId && entryId !== row.entryBId)) {
        affectedEntryIds.add(entryId);
      }
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
      bumpRowVersion: !swapped,
      entryAId: row.entryAId,
      entryBId: row.entryBId,
      id: row.id,
      status: row.status,
      walkover: row.walkover,
      winnerEntryId: row.winnerEntryId,
    });
  }

  return { affectedEntryIds: [...affectedEntryIds], updates };
}

/**
 * IBX-0053 gate: a drawn bracket with an "A definir" hole cannot go public —
 * `publishResult` needs two sides, so the hole would be an unplayable match in
 * an ongoing tournament. A hole is an empty side whose feed can never fill it
 * (the child row is a pruned `vacant` subtree). A side merely waiting for the
 * match below is NOT a hole (the normal drawn shape, direct phase entries
 * included), and pruned rows (vacant) and resolved byes expect nothing.
 */
export function validateBracketStartable(board: SwapBoardMatch[]) {
  for (const match of board) {
    if (match.status === "vacant" || match.walkover) {
      continue;
    }
    for (const side of ["a", "b"] as const) {
      if (entryOfSide(match, side) !== null) {
        continue;
      }
      // Round 1 has no feed: a row that is neither a bye nor vacant and still
      // has an empty side was emptied by a move and can never be completed.
      // From round 2 on the hole is an empty side fed by a pruned (vacant)
      // row; a side waiting for a LIVE feed below is the normal drawn shape.
      const child =
        match.round > 1
          ? findBoardMatch(
              board,
              match.round - 1,
              match.slotInRound * 2 + (side === "a" ? 0 : 1)
            )
          : undefined;
      if (match.round <= 1 || child?.status === "vacant") {
        return `A chave tem uma vaga em aberto (rodada ${match.round}). Complete a chave antes de iniciar.`;
      }
    }
  }
  return null;
}

/**
 * Rounds > 1 derive winners from earlier rounds: the parent's feeding side
 * takes the win of the child at these coordinates.
 */
export function nextMatchCoordinates(round: number, slotInRound: number) {
  return { round: round + 1, slotInRound: Math.floor(slotInRound / 2) };
}
