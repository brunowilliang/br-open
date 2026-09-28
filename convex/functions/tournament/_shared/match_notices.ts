import type { Id } from "../../_generated/dataModel";
import { buildPlayerProfileDisplayName } from "../../../domains/player/identity";
import {
  formatBracketStage,
  matchBecameReady,
  resolveCategoryTotalRounds,
} from "../../../domains/tournament/bracket-rules";
import {
  scheduleTournamentNotification,
  type OrmMutationCtx,
  type TournamentRecord,
} from "./guards";
import { entryRecipientUserIds } from "./match_writes";

export type MatchSidesSnapshot = {
  entryAId: null | string;
  entryBId: null | string;
};

/** Nome do lado na copy: "A e B" (um nome quando a dupla tem so um). */
async function resolveSideLabel(
  ctx: OrmMutationCtx,
  entryId: string
): Promise<string> {
  const entry = await ctx.orm.query.tournamentEntry.findFirst({
    where: { id: entryId as Id<"tournamentEntry"> },
  });
  const profileIds = [entry?.playerAId, entry?.playerBId].filter(
    (id): id is Id<"playerProfile"> => Boolean(id)
  );
  if (profileIds.length === 0) {
    return "";
  }

  const profiles = await ctx.orm.query.playerProfile.findMany({
    limit: profileIds.length,
    where: { id: { in: profileIds } },
  });
  const userIds = profiles
    .map((profile) => profile.userId)
    .filter((id): id is Id<"user"> => Boolean(id));
  const users =
    userIds.length > 0
      ? await ctx.orm.query.user.findMany({
          limit: userIds.length,
          where: { id: { in: userIds } },
        })
      : [];

  return profiles
    .map((profile) =>
      buildPlayerProfileDisplayName({
        fullName: profile.fullName,
        name: users.find((user) => user.id === profile.userId)?.name,
        nickname: profile.nickname,
        userId: profile.userId as string,
      })
    )
    .filter(Boolean)
    .join(" e ");
}

/**
 * Aviso de "proximo jogo": quando um confronto GANHA o lado que faltava, os dois
 * lados sao avisados (quem avancou e quem ja esperava). A chave publicada nao
 * passa por aqui: ela avisa todo mundo de uma vez, com os dois lados prontos.
 */
export async function notifyMatchReady(
  ctx: OrmMutationCtx,
  input: {
    after: MatchSidesSnapshot;
    before: MatchSidesSnapshot;
    categoryId: Id<"tournamentCategory">;
    matchId: string;
    round: number;
    tournament: TournamentRecord;
  }
) {
  if (!(input.after.entryAId && input.after.entryBId)) {
    return;
  }
  if (!matchBecameReady({ after: input.after, before: input.before })) {
    return;
  }

  const recipients = await entryRecipientUserIds(ctx, [
    input.after.entryAId,
    input.after.entryBId,
  ]);
  if (recipients.length === 0) {
    return;
  }

  const [sideALabel, sideBLabel, categoryMatches] = await Promise.all([
    resolveSideLabel(ctx, input.after.entryAId),
    resolveSideLabel(ctx, input.after.entryBId),
    ctx.orm.query.tournamentMatch.findMany({
      limit: 200,
      where: { categoryId: input.categoryId },
    }),
  ]);

  await scheduleTournamentNotification(ctx, {
    eventType: "tournament.match.ready",
    metadata: {
      matchId: input.matchId,
      sideALabel,
      sideBLabel,
      stageLabel: formatBracketStage(
        input.round,
        resolveCategoryTotalRounds(categoryMatches)
      ),
    },
    recipientUserIds: recipients,
    sourceEntityId: input.matchId,
    sourceEntityType: "tournamentMatch",
    tournamentId: input.tournament.id as Id<"tournament">,
  });
}
