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
// Slot swap (same-round slots, spec-approved; IBX-0035 generalizes beyond
// round 1 — direct entries occupy round >= 2 sides at draw time)
// ---------------------------------------------------------------------------

export type BracketMatchSide = "a" | "b";

export type SwapMatchStatus =
  | "pending"
  | "scheduled"
  | "vacant"
  | "walkover"
  | "finished";

export type SwapCheckMatch = {
  entryAId: string | null;
  entryBId: string | null;
  round: number;
  slotInRound: number;
  /** Published (organizer-entered) result — blocks the swap. */
  hasPublishedResult: boolean;
  winnerEntryId: string | null;
  /** Scheduling date (league pattern); keeps the match scheduled on swap. */
  matchDate: string | null;
  /** Original status — preserved verbatim when a result was published. */
  status: SwapMatchStatus;
};

function entryOfSide(
  match: { entryAId: string | null; entryBId: string | null },
  side: BracketMatchSide
): string | null {
  return side === "a" ? match.entryAId : match.entryBId;
}

/**
 * Status a swapped match ends up with. Published results are explicit state
 * and are preserved verbatim (a swap is blocked when one exists, but the
 * rule must never derive over one — re-sorting after a race would corrupt
 * the bracket otherwise). Vacant rows are never swappable (no filled
 * sides) and stay vacant defensively; byes stay walkover; a scheduled date
 * keeps the match scheduled; everything else goes back to pending.
 */
export function deriveSwapMatchStatus(input: {
  hasMatchDate: boolean;
  hasPublishedResult: boolean;
  isBye: boolean;
  originalStatus: SwapMatchStatus;
}): SwapMatchStatus {
  if (input.hasPublishedResult || input.originalStatus === "vacant") {
    return input.originalStatus;
  }
  if (input.isBye) {
    return "walkover";
  }
  return input.hasMatchDate ? "scheduled" : "pending";
}

/**
 * Persist plan for a swap: ONLY the two slots being swapped are rewritten,
 * each with the status derived above. Any other match of the round keeps
 * its rows untouched.
 */
export function buildSwapPersistPlan(input: {
  roundMatches: SwapCheckMatch[];
  slotA: number;
  slotB: number;
  isByeA: boolean;
  isByeB: boolean;
}): Array<{
  index: number;
  status: SwapMatchStatus;
  walkover: boolean;
}> {
  return [
    { index: input.slotA, isBye: input.isByeA },
    { index: input.slotB, isBye: input.isByeB },
  ].map(({ index, isBye }) => {
    const original = input.roundMatches[index];
    return {
      index,
      status: deriveSwapMatchStatus({
        hasMatchDate: original.matchDate !== null,
        hasPublishedResult: original.hasPublishedResult,
        isBye,
        originalStatus: original.status,
      }),
      walkover: isBye,
    };
  });
}

/**
 * IBX-0038 (review C1): swap authorization. `getManagedTournamentOrThrow`
 * only proves ownership of the tournamentId it receives — the swapped
 * category must be proven to belong to that same tournament, otherwise an
 * organizer of tournament A could shuffle tournament B's bracket through a
 * forged categoryId.
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
 * Swap validation: same-round slots only (the procedure feeds one round's
 * matches); both affected matches must have no published result. Bye
 * resolutions (auto walkovers from the draw) are NOT published results —
 * they are re-derivable, so swapping with a bye slot is allowed (spec:
 * "incluindo slots de bye"). Vacant sides have nothing to move and are
 * refused by the filled-side check below.
 */
export function validateSlotSwap(
  roundMatches: SwapCheckMatch[],
  slotA: number,
  sideA: BracketMatchSide,
  slotB: number,
  sideB: BracketMatchSide
) {
  const matchCount = roundMatches.length;
  if (slotA === slotB) {
    return "Escolha duas posições diferentes.";
  }
  if (slotA < 0 || slotB < 0 || slotA >= matchCount || slotB >= matchCount) {
    return "Posição inválida na chave.";
  }

  for (const slot of [slotA, slotB]) {
    if (roundMatches[slot].hasPublishedResult) {
      return "Esse confronto já tem resultado publicado e não pode ser ajustado.";
    }
  }

  // The swap moves exactly the entry the organizer clicked. A free side
  // (bye) has nothing to move — refuse rather than silently moving its pair.
  for (const [slot, side] of [
    [slotA, sideA],
    [slotB, sideB],
  ] as const) {
    if (entryOfSide(roundMatches[slot], side) === null) {
      return "Escolha uma posição preenchida para trocar.";
    }
  }
  return null;
}

/**
 * Pure swap of the entries occupying two same-round slots, returning the
 * patched round matches with byes re-resolved. The caller persists these
 * and re-propagates winners into the next round (blocked by
 * `hasPublishedResult` there). Bye re-derivation is round-1 only: a
 * round >= 2 match with one filled side is WAITING for a winner, not a
 * bye (direct entries make that shape possible at draw time).
 */
export function applySlotSwap(
  roundMatches: BuiltBracketMatch[],
  slotA: number,
  sideA: BracketMatchSide,
  slotB: number,
  sideB: BracketMatchSide
): BuiltBracketMatch[] {
  const patched = roundMatches.map((match) => ({ ...match }));
  const matchA = patched[slotA];
  const matchB = patched[slotB];

  const sideKey = (side: BracketMatchSide) =>
    side === "a" ? "entryAId" : "entryBId";
  const entry = entryOfSide(matchA, sideA);
  matchA[sideKey(sideA)] = entryOfSide(matchB, sideB);
  matchB[sideKey(sideB)] = entry;

  for (const match of [matchA, matchB]) {
    const hasOneSide = match.entryAId === null || match.entryBId === null;
    match.isBye =
      match.round === 1 &&
      hasOneSide &&
      (match.entryAId !== null || match.entryBId !== null);
    match.winnerEntryId = match.isBye
      ? (match.entryAId ?? match.entryBId)
      : null;
  }

  return patched;
}

/**
 * Rounds > 1 derive winners from earlier rounds. After a swap the caller
 * re-feeds winners into later matches; this helper picks the next match
 * coordinates for a finished match.
 */
export function nextMatchCoordinates(round: number, slotInRound: number) {
  return { round: round + 1, slotInRound: Math.floor(slotInRound / 2) };
}
