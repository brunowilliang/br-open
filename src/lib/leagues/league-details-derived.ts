import type { ApiOutputs } from "@convex/shared/api";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];
type MembershipOverview = ApiOutputs["league"]["membership"]["getOverview"];
type RuleConfig = LeagueOverview["ruleConfig"];
type RankingEntry = MembershipOverview["ranking"][number];

export type LeagueDetailsRole = "visitor" | "participant" | "owner";

export type LeagueDetailsAccess = {
  canOpenChallenges: boolean;
  canOpenRanking: boolean;
  canOpenRequests: boolean;
  canOpenRules: boolean;
};

export type LeagueDetailsRankingItem = {
  avatarUrl?: null | string;
  id: string;
  isChallengeable: boolean;
  isViewerItem: boolean;
  name: string;
  nickname: string;
  playerProfileId: string;
  position: number;
};

export type LeagueDetailsRequestItem = {
  avatarUrl?: null | string;
  id: string;
  name: string;
  nickname: string;
};

export type LeagueDetailsRequestContentState =
  | "empty"
  | "error"
  | "list"
  | "loading";

export type LeagueDetailsRulesView = {
  challenge: {
    activeLimit: string;
    maxDistance: string;
    monthlyLimit: string;
    responseDeadline: string;
  };
  match: {
    duration: string;
    finalSet: string;
    format: string;
    scoring: string;
    setFormat: string;
    tieBreak: string;
  };
  inactivity: string;
  progression: {
    lossBehavior: string;
    newPlayerPlacement: string;
    walkoverBehavior: string;
    winBehavior: string;
  };
  validation: {
    challenge: string;
    result: string;
  };
};

export function buildLeagueDetailsRole(input: {
  canUseOrganizerCapabilities: boolean;
  isManagerOwner: boolean;
  viewerMembershipStatus: null | string | undefined;
}): LeagueDetailsRole {
  if (input.canUseOrganizerCapabilities && input.isManagerOwner) {
    return "owner";
  }

  if (input.viewerMembershipStatus === "active") {
    return "participant";
  }

  return "visitor";
}

export function buildLeagueDetailsAccess(
  role: LeagueDetailsRole
): LeagueDetailsAccess {
  return {
    canOpenChallenges: role === "participant" || role === "owner",
    canOpenRanking: role === "participant" || role === "owner",
    canOpenRequests: role === "owner",
    canOpenRules: true,
  };
}

export function buildLeagueDetailsCanOpenLeagueMenu(
  access: LeagueDetailsAccess
) {
  return (
    access.canOpenRanking ||
    access.canOpenChallenges ||
    access.canOpenRules ||
    access.canOpenRequests
  );
}

function normalizeActionCount(value: number) {
  return Math.max(0, Math.trunc(value));
}

export function buildLeagueDetailsMenuActionCounts(input: {
  access: LeagueDetailsAccess;
  challengeActionCount: number;
  requestActionCount: number;
}) {
  const challenges = input.access.canOpenChallenges
    ? normalizeActionCount(input.challengeActionCount)
    : 0;
  const requests = input.access.canOpenRequests
    ? normalizeActionCount(input.requestActionCount)
    : 0;

  return {
    challenges,
    requests,
    total: challenges + requests,
  };
}

export function shouldFetchLeagueDetailsMembershipOverview(
  access: LeagueDetailsAccess
) {
  return access.canOpenRanking || access.canOpenRequests;
}

export function buildLeagueDetailsCanRequestJoin(input: {
  canJoinLeagues: boolean;
  role: LeagueDetailsRole;
  viewerMembershipStatus: null | string | undefined;
}) {
  return (
    input.canJoinLeagues &&
    input.role === "visitor" &&
    input.viewerMembershipStatus !== "pending"
  );
}

export function buildLeagueDetailsShowJoinFooter(input: {
  canJoinLeagues: boolean;
  role: LeagueDetailsRole;
}) {
  return input.canJoinLeagues && input.role === "visitor";
}

export function buildLeagueDetailsRequestItems(
  membershipOverview:
    | null
    | Pick<MembershipOverview, "pendingRequests">
    | undefined
): LeagueDetailsRequestItem[] {
  return (
    membershipOverview?.pendingRequests.map((item) => ({
      avatarUrl: item.player.avatarUrl,
      id: item.id,
      name: item.player.fullName,
      nickname: item.player.nickname,
    })) ?? []
  );
}

export function resolveLeagueDetailsVisibleRequestItems(input: {
  membershipOverview:
    | null
    | Pick<MembershipOverview, "pendingRequests">
    | undefined;
  requestItems: LeagueDetailsRequestItem[];
}) {
  if (input.membershipOverview) {
    return buildLeagueDetailsRequestItems(input.membershipOverview);
  }

  return input.requestItems;
}

export function resolveLeagueDetailsRequestContentState(input: {
  isError: boolean;
  isFetching: boolean;
  isPending: boolean;
  requestCount: number;
}): LeagueDetailsRequestContentState {
  if (input.isPending) {
    return "loading";
  }

  if (input.isError) {
    return "error";
  }

  if (input.isFetching && input.requestCount === 0) {
    return "loading";
  }

  return input.requestCount === 0 ? "empty" : "list";
}

export function resolveLeagueDetailsViewerPosition(input: {
  rankingItems: Array<{
    playerProfileId?: string;
    position: number;
  }>;
  viewerPlayerProfileId: null | string;
}) {
  return (
    input.rankingItems.find(
      (item) => item.playerProfileId === input.viewerPlayerProfileId
    )?.position ?? null
  );
}

export function buildLeagueDetailsRankingItems(input: {
  maxChallengeDistance: number;
  ranking: MembershipOverview["ranking"];
  role: LeagueDetailsRole;
  viewerPlayerProfileId: null | string;
}): LeagueDetailsRankingItem[] {
  const items = input.ranking.map((item, index) =>
    buildRankingItem({
      item,
      position: item.rankingPosition ?? index + 1,
      viewerPlayerProfileId: input.viewerPlayerProfileId,
    })
  );

  const viewerPosition = resolveLeagueDetailsViewerPosition({
    rankingItems: items,
    viewerPlayerProfileId: input.viewerPlayerProfileId,
  });

  return items.map((item) => ({
    ...item,
    isChallengeable:
      input.role === "participant" &&
      typeof viewerPosition === "number" &&
      item.playerProfileId !== input.viewerPlayerProfileId &&
      item.position < viewerPosition &&
      viewerPosition - item.position <= input.maxChallengeDistance,
  }));
}

function buildRankingItem(input: {
  item: RankingEntry;
  position: number;
  viewerPlayerProfileId: null | string;
}) {
  return {
    avatarUrl: input.item.player.avatarUrl,
    id: input.item.id,
    isChallengeable: false,
    isViewerItem: input.item.playerProfileId === input.viewerPlayerProfileId,
    name: input.item.player.fullName,
    nickname: input.item.player.nickname,
    playerProfileId: input.item.playerProfileId,
    position: input.position,
  } satisfies LeagueDetailsRankingItem;
}

function formatResponseDeadlineHours(hours: number) {
  switch (hours) {
    case 12:
      return "12 horas";
    case 24:
      return "24 horas";
    case 48:
      return "48 horas";
    case 72:
      return "3 dias";
    case 120:
      return "5 dias";
    case 168:
      return "7 dias";
    default:
      return `${hours} horas`;
  }
}

function formatWinBehavior(value: RuleConfig["winBehavior"]) {
  switch (value) {
    case "climb_one_position":
      return "Quem vence sobe 1 posição.";
    default:
      return "Quem vence assume a posição do adversário.";
  }
}

function formatLossBehavior(value: RuleConfig["lossBehavior"]) {
  switch (value) {
    case "drop_one_position":
      return "Quem perde cai 1 posição.";
    default:
      return "Quem perde permanece onde está.";
  }
}

function formatWalkoverBehavior(value: RuleConfig["walkoverBehavior"]) {
  switch (value) {
    case "automatic_loss_and_move_to_end":
      return "W.O. conta como derrota e leva o jogador ao final do ranking.";
    case "cancel_challenge":
      return "W.O. cancela o desafio e libera os jogadores.";
    default:
      return "W.O. conta como derrota automática.";
  }
}

function formatNewPlayerPlacement(value: RuleConfig["newPlayerPlacement"]) {
  switch (value) {
    case "end_of_ranking":
    default:
      return "Novos jogadores entram no final do ranking.";
  }
}

function formatScoringMode(value: RuleConfig["matchConfig"]["scoringMode"]) {
  switch (value) {
    case "no_advantage":
      return "Sem vantagem";
    default:
      return "Com vantagem";
  }
}

function formatTieBreak(ruleConfig: RuleConfig) {
  const { matchConfig } = ruleConfig;

  if (!matchConfig.hasTieBreak) {
    return "Sets sem tie-break";
  }

  const differenceRule = matchConfig.tieBreakMustWinByTwo
    ? "com 2 de diferença"
    : "ponto decisivo";

  return `Tie-break em ${matchConfig.tieBreakAtGamesAll}x${matchConfig.tieBreakAtGamesAll}, ${matchConfig.tieBreakPoints} pontos, ${differenceRule}`;
}

function formatFinalSet(ruleConfig: RuleConfig) {
  const { matchConfig } = ruleConfig;

  switch (matchConfig.finalSetMode) {
    case "custom_set":
      return `Último set com ${matchConfig.finalSetGamesPerSet} games`;
    case "super_tiebreak":
      return `Último set em super tie-break de ${matchConfig.finalSetSuperTieBreakPoints} pontos`;
    default:
      return "Último set igual aos anteriores";
  }
}

function formatInactivity(ruleConfig: RuleConfig) {
  if (!ruleConfig.hasInactivityPenalty) {
    return "A liga não aplica queda automática por inatividade.";
  }

  if (ruleConfig.inactivityPenaltyType === "move_to_ranking_end") {
    return `Após ${ruleConfig.inactivityPenaltyDays} dias sem jogar, o jogador vai para o final do ranking.`;
  }

  return `Após ${ruleConfig.inactivityPenaltyDays} dias sem jogar, o jogador cai 1 posição.`;
}

export function buildLeagueRulesView(
  ruleConfig: LeagueOverview["ruleConfig"]
): LeagueDetailsRulesView {
  return {
    challenge: {
      activeLimit: `${ruleConfig.maxActiveChallengesPerPlayer} ativos`,
      maxDistance: `${ruleConfig.maxChallengeDistance} posições acima`,
      monthlyLimit: `${ruleConfig.maxChallengesPerMonth} por mês`,
      responseDeadline: formatResponseDeadlineHours(
        ruleConfig.responseDeadlineHours
      ),
    },
    inactivity: formatInactivity(ruleConfig),
    match: {
      duration: `${ruleConfig.matchConfig.defaultDurationMinutes} min`,
      finalSet: formatFinalSet(ruleConfig),
      format: `Melhor de ${ruleConfig.matchConfig.bestOfSets} sets`,
      scoring: formatScoringMode(ruleConfig.matchConfig.scoringMode),
      setFormat: `${ruleConfig.matchConfig.gamesPerSet} games`,
      tieBreak: formatTieBreak(ruleConfig),
    },
    progression: {
      lossBehavior: formatLossBehavior(ruleConfig.lossBehavior),
      newPlayerPlacement: formatNewPlayerPlacement(
        ruleConfig.newPlayerPlacement
      ),
      walkoverBehavior: formatWalkoverBehavior(ruleConfig.walkoverBehavior),
      winBehavior: formatWinBehavior(ruleConfig.winBehavior),
    },
    validation: {
      challenge:
        ruleConfig.challengeValidationMode === "manual"
          ? "Manual"
          : "Automática",
      result:
        ruleConfig.resultValidationMode === "manual" ? "Manual" : "Automática",
    },
  };
}
