/**
 * Shared bracket row helpers for the function layer: the move rules (bracket.ts)
 * and the incremental placement (placement.ts) read the same category board and
 * need the same randomness injection.
 */
import type { InferSelectModel } from "kitcn/orm";
import type { Id } from "../../_generated/dataModel";
import type {
  SwapBoardMatch,
  SwapMatchStatus,
} from "../../../domains/tournament/bracket-rules";
import type { tournamentMatch } from "../../../domains/tournament/tables";
import type { OrmCtx } from "./guards";

export type MatchRecord = InferSelectModel<typeof tournamentMatch>;

/**
 * The move AND placement rules read the category's WHOLE board — how a
 * side's occupant arrived (a placement vs a win propagated from the match
 * below) is what decides whether it may move or what a fit re-derives.
 */
export function toSwapBoard(matches: MatchRecord[]): SwapBoardMatch[] {
  return matches.map((match) => ({
    entryAId: match.entryAId ?? null,
    entryBId: match.entryBId ?? null,
    hasPublishedResult:
      match.publishedAt !== null && match.publishedAt !== undefined,
    id: match.id as string,
    round: match.round,
    slotInRound: match.slotInRound,
    status: match.status as SwapMatchStatus,
    walkover: match.walkover,
    winnerEntryId: match.winnerEntryId ?? null,
  }));
}

/** Fisher-Yates on a copy — the only randomness in the draw path. */
export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** All bracket rows of one category, ordered by round/slot (bounded). */
export function getCategoryMatches(
  ctx: OrmCtx,
  categoryId: Id<"tournamentCategory">
) {
  return ctx.orm.query.tournamentMatch.findMany({
    limit: 300,
    where: { categoryId },
  });
}
