import type { ApiOutputs } from "@convex/shared/api";

import { formatShortDate } from "@/lib/format/date";
import { DAY_MS } from "@/lib/format/relative-time";
import { clampToNonNegativeInt } from "@/lib/numbers";
import { getMembershipActionLabel } from "@/lib/leagues/presentation";
import { formatBrazilDueDayLabel } from "@/lib/payments/membership-due";
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

/**
 * `payment_due` (membro em carência) SEGUE membro: o pagamento está atrasado,
 * mas o acesso permanece até o fim da carência e o aviso de pagamento com o
 * CTA de pagar vive no overview de membro (IBX-0039). `awaiting_payment`
 * (entrada ainda não ativada) e `suspended` seguem como visitante.
 */
export function buildLeagueDetailsRole(input: {
  canUseOrganizerCapabilities: boolean;
  isLeagueOrganizer: boolean;
  viewerMembershipStatus: null | string | undefined;
}): LeagueDetailsRole {
  if (input.canUseOrganizerCapabilities && input.isLeagueOrganizer) {
    return "organizer";
  }

  return input.viewerMembershipStatus === "active" ||
    input.viewerMembershipStatus === "payment_due"
    ? "player"
    : "guest";
}

export type LeaguePaymentAlert = {
  /** Label do CTA dentro do alerta; null quando o CTA já vive na tela. */
  actionLabel: null | string;
  description: string;
  severity: "danger" | "warning";
  title: string;
};

/**
 * Aviso de pagamento da inscrição na liga (IBX-0039). Cobre o membro em
 * carência (`payment_due`), o suspenso (`suspended`, que segue como visitante
 * e cujo CTA vive no rodapé) e o membro `active` dentro da janela de lembrete
 * (`reminderDaysBefore` antes do vencimento).
 *
 * `dueAt` é o vencimento do ciclo atual (`viewerMembershipDueAt` no contrato —
 * C5). Enquanto a liga não entregar o campo, chame com `null`: sem data não há
 * como saber se o membro `active` está na janela, então o aviso de renovação
 * simplesmente não aparece e os casos por status seguem valendo.
 */
export function buildLeaguePaymentAlert(input: {
  dueAt?: null | number;
  now: number;
  reminderDaysBefore: number;
  status: null | string | undefined;
}): LeaguePaymentAlert | null {
  if (input.status === "payment_due") {
    return {
      actionLabel: getMembershipActionLabel(input.status),
      description:
        "O pagamento da sua mensalidade venceu. Pague para não ser suspenso.",
      severity: "warning",
      title: "Pagamento atrasado",
    };
  }

  if (input.status === "suspended") {
    return {
      actionLabel: null,
      description:
        "Sua inscrição foi suspensa por falta de pagamento. Renove para voltar a jogar.",
      severity: "danger",
      title: "Inscrição suspensa",
    };
  }

  if (input.status !== "active" || !input.dueAt) {
    return null;
  }

  const msUntilDue = input.dueAt - input.now;

  if (msUntilDue <= 0 || msUntilDue > input.reminderDaysBefore * DAY_MS) {
    return null;
  }

  return {
    actionLabel: "Renovar mensalidade",
    description: `Renove até ${formatShortDate(
      new Date(input.dueAt)
    )} para continuar jogando sem interrupção.`,
    severity: "warning",
    title: `Mensalidade vence ${formatBrazilDueDayLabel(
      input.dueAt,
      input.now
    )}`,
  };
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
 * Quando o rodapé da liga vira atalho direto para o checkout em vez de
 * solicitar entrada. Vale para quem ainda cai no rodapé (`awaiting_payment` e
 * `suspended`). Desde o IBX-0039 o `payment_due` é membro e o CTA dele vive no
 * aviso de pagamento do overview, não no rodapé.
 */
export function buildLeagueDetailsCanResumeCheckout(input: {
  viewerMembershipStatus: null | string | undefined;
}) {
  return (
    input.viewerMembershipStatus === "awaiting_payment" ||
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
      finalSet: formatFinalSet(ruleConfig.matchConfig),
      format: `Melhor de ${ruleConfig.matchConfig.bestOfSets} sets`,
      scoring: formatScoringMode(ruleConfig.matchConfig.scoringMode),
      setFormat: `${ruleConfig.matchConfig.gamesPerSet} games`,
      tieBreak: formatTieBreak(ruleConfig.matchConfig),
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
