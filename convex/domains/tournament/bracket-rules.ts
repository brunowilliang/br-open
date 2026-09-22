/** Pure single-elimination rules: deterministic and Convex-free (unit-testable). */

export type BracketSeedEntry = {
  entryId: string;
  seedRank: number | null;
  /** Round the entry enters the bracket; >= 2 = direct entry (head of seed). */
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

/** `order[i]` = seed at slot `i`; slot `i` plays `i ^ 1`, so top seeds only meet late. */
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

/** Present seeds must be 1..s with no gap/duplicate — defends against stale payloads. */
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

/** `published` = first draw, `drawn` = re-draw (nothing published yet); `ongoing` never. */
export function canDrawTournament(status: string) {
  return status === "published" || status === "drawn";
}

/** A direct entry needs a seed; each skipped round spends 2^(r-1) - 1 byes, and the pruned blocks must be pairwise disjoint (an overlap leaves a dead subtree). */
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

/** `entries` come pre-shuffled from the caller — seeding placement and byes ignore that order. */
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

  // 1. Direct entries claim their seed's side-slot AT the entry round; two
  // claims on one side-slot mean those heads would meet too early — rejected.
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

  // 2. Whole round-1 regions below a claimed side-slot persist as VACANT
  // rows (no sides, no winner) so the emitted grid stays complete.
  const prunedSlot = new Array<boolean>(totalSlots).fill(false);
  for (const key of claimByRoundSideSlot.keys()) {
    const [round, sideSlot] = key.split(":").map(Number);
    const blockSize = 2 ** (round - 1);
    const blockStart = sideSlot * blockSize;
    for (let slot = blockStart; slot < blockStart + blockSize; slot += 1) {
      prunedSlot[slot] = true;
    }
  }

  // 3. A seed kept in the first round whose region was absorbed by a direct entry
  // has no standard position left — surfaced as a draw error, so the organizer
  // must advance or unseed it.
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

  // 4. Byes are the weakest live free slots, at most one per round-1 pair (byes
  // land opposite the top seeds); each direct entry eats 2^(r-1) - 1 byes.
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

  // 5. Non-seeded entries fill the remaining live free slots in caller order.
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

  // 6. A side-slot is LIVE when claimed by a direct entry, when it hosts a round-1
  // player/bye, or when fed by a live child; dead subtrees are VACANT. Byes resolve
  // immediately (walkover) and feed the next round.
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

export function isBracketFinished(bracket: BuiltBracket) {
  return getFinalRoundMatch(bracket).winnerEntryId !== null;
}

// Slot move: rules read the WHOLE board, because moving a side depends on how its
// occupant arrived — a placement moves, a propagated win does not.

export type BracketMatchSide = "a" | "b";

export type SwapMatchStatus =
  | "pending"
  | "scheduled"
  | "vacant"
  | "walkover"
  | "finished";

export type BracketSwapCoordinate = {
  round: number;
  side: BracketMatchSide;
  slotInRound: number;
};

/** `walkover` = draw-time bye; `winnerEntryId` = decided win feeding the parent. */
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
 * Status a rewritten row ends with: a published result is preserved verbatim; no
 * sides → vacant; only a row that ALREADY was a bye keeps advancing (moving a bye's
 * head keeps the shape). Any other lone side is "A definir" — the move never hands
 * the opponent a walkover, and a lone side above the first round waits for the feed
 * (`buildBracket` only ever makes round-1 byes). The agenda dies with the pair.
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

/** Derives status/bye/winner in place; idempotent while the row keeps one side. */
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
 * A side is DERIVED when its occupant is not a placement but the WIN fed by the
 * child; a win from a published result is not re-derivable (move refused) while the
 * draw's bye is re-derived with its survivor. Placements stay movable.
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

const DERIVED_SIDE_LOCKED =
  "Essa vaga vem de um confronto já decidido e não pode ser ajustada.";

/**
 * The PLACEMENT a clicked side really moves: descends the feed chain while the side
 * is derived (a bye propagated into the next card), permuting the ENTRIES; the
 * caller re-derives the bye. A link from a PUBLISHED result is untouchable.
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
 * EDITABLE preview only while `drawn`: starting the tournament FREEZES positions.
 */
export function validateSwapWindow(input: { status: string }) {
  if (input.status === "drawn") {
    return null;
  }
  return "O chaveamento foi congelado no início do torneio.";
}

/**
 * Feed writes the move implies: a resolved bye pushes its winner into the parent,
 * one that lost its bye pulls the old win back. Legal only over the win of THIS
 * match (anything else is a placement) and never into a parent with a published
 * result.
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
    // Even child slot feeds side A of its parent, odd feeds side B.
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

  // Second pass: a rewritten row that now has TWO sides becomes playable, and
  // publishing it overwrites the parent's side (no occupancy check there). The draw
  // only leaves that side free for a playable row — a direct entry PRUNES the whole
  // subtree below it — so completing a pruned row would drop the entry held above.
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
 * Single source of the move: static checks, the descent from a derived side to the
 * placement it moves, the permutation, both re-derived statuses and the feed writes.
 * `resolved` carries the coordinates actually permuted, so the persist plan can tell
 * rewritten rows from fed ones. On error the board comes back UNTOUCHED.
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

  // A free side has nothing to move.
  if (entryOfSide(matchFrom, from.side) === null) {
    return rejected("Escolha uma posição preenchida para trocar.");
  }

  // An empty side only accepts an entry when nothing can land there first: the first
  // round, or a side fed by a pruned (vacant) row. A side waiting for a LIVE feed
  // would be overwritten when that match publishes its winner (matches.ts writes it
  // without checking occupancy) and the entry would vanish.
  const destinationFeedIsDead =
    to.round <= 1 ||
    findBoardMatch(
      board,
      to.round - 1,
      to.slotInRound * 2 + (to.side === "a" ? 0 : 1)
    )?.status === "vacant";
  if (entryOfSide(matchTo, to.side) === null && !destinationFeedIsDead) {
    return rejected(
      "Essa vaga ainda vai receber o vencedor do confronto de baixo, e só uma linha podada aceita uma inscrição."
    );
  }

  // A side whose occupant came from the child's win has no placement of its own:
  // descend to the side that holds the entry and re-derive the bye / advance.
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
 * `status` only feeds the window (`drawn` only); the procedure already gates it.
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
 * Ownership of the tournamentId is not enough: the moved category must belong to
 * that same tournament, else a forged categoryId shuffles another bracket.
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
 * Pure move: the caller validates first — an invalid move comes back UNCHANGED.
 */
export function applySlotSwap(move: BracketSwapMove) {
  return planSwap(move).patched;
}

/**
 * Rows to persist after a validated move: the two rewritten matches plus every feed
 * row whose win changed — untouched rows stay out, so the agenda only dies with the
 * rewritten pairs. `affectedEntryIds` = both clicked sides plus whoever lost the
 * side a feed write emptied.
 */
export function buildSwapPersistPlan(move: BracketSwapMove) {
  const plan = planSwap(move);
  const patched = plan.patched;
  // The rows the click permuted are the PLACEMENTS the move descended to, so a
  // clicked side derived from a bye lands here as a fed row.
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
    // Both clicked players are notified; a feed row notifies the retired winner.
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
 * A draw with an "A definir" hole cannot go public: `publishResult` needs two sides,
 * so the hole would be an unplayable match. A hole is an empty side whose feed can
 * never fill it (the child row is pruned `vacant`); a side merely waiting for the
 * match below is NOT the hole, and pruned rows and resolved byes expect nothing.
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
      // No feed in the first round: a row that is neither bye nor vacant with an empty
      // side was emptied by a move. Above it, a hole is an empty side fed by a pruned
      // (vacant) row — waiting for a LIVE feed below is the normal drawn shape.
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

/** Rounds > 1 derive winners: the parent's feeding side takes this child's win. */
export function nextMatchCoordinates(round: number, slotInRound: number) {
  return { round: round + 1, slotInRound: Math.floor(slotInRound / 2) };
}
