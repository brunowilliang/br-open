import type { ApiOutputs } from "@convex/shared/api";

import { clampToNonNegativeInt } from "@/lib/numbers";
import {
  formatFinalSet,
  formatInactivity,
  formatLossBehavior,
  formatNewPlayerPlacement,
  formatResponseDeadlineHours,
  formatScoringMode,
  formatTieBreak,
  formatWalkoverBehavior,
  formatWinBehavior,
} from "@/lib/leagues/rule-format";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];
type MembershipOverview = ApiOutputs["league"]["membership"]["getOverview"];
type RankingEntry = MembershipOverview["ranking"][number];

export type LeagueDetailsRole = "guest" | "player" | "organizer";

export type LeagueDetailsAccess = {
  canOpenChallenges: boolean;
  canOpenRanking: boolean;
  canOpenRequests: boolean;
  canOpenRules: boolean;
  canOpenSchedule: boolean;
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
  isLeagueOrganizer: boolean;
  viewerMembershipStatus: null | string | undefined;
}): LeagueDetailsRole {
  if (input.canUseOrganizerCapabilities && input.isLeagueOrganizer) {
    return "organizer";
  }

  if (input.viewerMembershipStatus === "active") {
    return "player";
  }

  return "guest";
}

export function buildLeagueDetailsAccess(input: {
  role: LeagueDetailsRole;
  scheduleVisibility: "members_only" | "public";
}): LeagueDetailsAccess {
  const isMember = input.role === "player" || input.role === "organizer";
  return {
    canOpenChallenges: isMember,
    canOpenRanking: isMember,
    canOpenRequests: input.role === "organizer",
    canOpenRules: true,
    canOpenSchedule: input.scheduleVisibility === "public" ? true : isMember,
  };
}

export function buildLeagueDetailsCanOpenLeagueMenu(
  access: LeagueDetailsAccess
) {
  return (
    access.canOpenRanking ||
    access.canOpenChallenges ||
    access.canOpenRules ||
    access.canOpenRequests ||
    access.canOpenSchedule
  );
}

export function buildLeagueDetailsMenuActionCounts(input: {
  access: LeagueDetailsAccess;
  challengeActionCount: number;
  requestActionCount: number;
}) {
  const challenges = input.access.canOpenChallenges
    ? clampToNonNegativeInt(input.challengeActionCount)
    : 0;
  const requests = input.access.canOpenRequests
    ? clampToNonNegativeInt(input.requestActionCount)
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
  const isAwaitingAction =
    input.viewerMembershipStatus === "pending" ||
    input.viewerMembershipStatus === "awaiting_payment" ||
    input.viewerMembershipStatus === "payment_due" ||
    input.viewerMembershipStatus === "suspended";
  return input.canJoinLeagues && input.role === "guest" && !isAwaitingAction;
}

/**
 * When the viewer is `awaiting_payment` (initial charge), `payment_due`
 * (grace period — can still play but needs to pay), or `suspended`
 * (renewal overdue), the join button becomes a shortcut to the checkout
 * screen. This is independent of `canRequestJoin` which gates the *initial*
 * join request.
 */
export function buildLeagueDetailsCanResumeCheckout(input: {
  viewerMembershipStatus: null | string | undefined;
}) {
  return (
    input.viewerMembershipStatus === "awaiting_payment" ||
    input.viewerMembershipStatus === "payment_due" ||
    input.viewerMembershipStatus === "suspended"
  );
}

export function buildLeagueDetailsShowJoinFooter(input: {
  canJoinLeagues: boolean;
  role: LeagueDetailsRole;
}) {
  return input.canJoinLeagues && input.role === "guest";
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
      input.role === "player" &&
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

export function buildLeagueRulesView(
  ruleConfig: LeagueOverview["ruleConfig"]
): LeagueDetailsRulesView {
  return {
    challenge: {
      activeLimit: ruleConfig.maxActiveChallengesPerPlayer.enabled
        ? `${ruleConfig.maxActiveChallengesPerPlayer.value} ativos`
        : "Sem limite de ativos",
      maxDistance: ruleConfig.maxChallengeDistance.enabled
        ? `${ruleConfig.maxChallengeDistance.value} posições acima`
        : "Sem limite de distância",
      monthlyLimit: ruleConfig.maxChallengesPerMonth.enabled
        ? `${ruleConfig.maxChallengesPerMonth.value} por mês`
        : "Sem limite mensal",
      responseDeadline: ruleConfig.responseDeadlineHours.enabled
        ? formatResponseDeadlineHours(ruleConfig.responseDeadlineHours.value)
        : "Sem prazo de resposta",
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
