import type { ApiOutputs } from "@convex/shared/api";

export type ChallengeItem =
  ApiOutputs["league"]["challenges"]["listForLeague"][number];

export type ChallengeStatus = ChallengeItem["status"];

export type MembershipOverview =
  ApiOutputs["league"]["membership"]["getOverview"];

// ----- Alerts -----

export type OrganizerMonthlyMatchesPoint = {
  matches: number;
  month: string;
};

const TREND_MONTHS = 6;

/** Série "partidas por mês" (últimos 6 meses, ordem cronológica) a partir
 * dos desafios FINALIZADOS (`finishedAt`). Meses sem partida entram com
 * zero: a tendência é a resposta de "a liga está viva?". */
export function buildOrganizerMonthlyMatchesSeries(input: {
  challenges: ChallengeItem[];
  now: number;
}): OrganizerMonthlyMatchesPoint[] {
  const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });
  const cursor = new Date(input.now);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);

  const windows: Array<{
    label: string;
    matches: number;
    startMs: number;
  }> = [];

  for (let index = TREND_MONTHS - 1; index >= 0; index -= 1) {
    const windowStart = new Date(cursor);
    windowStart.setMonth(cursor.getMonth() - index);

    windows.push({
      label: monthFormatter.format(windowStart),
      matches: 0,
      startMs: windowStart.getTime(),
    });
  }

  for (const challenge of input.challenges) {
    if (
      challenge.status !== "finished" ||
      challenge.finishedAt === null ||
      challenge.finishedAt === undefined
    ) {
      continue;
    }

    const window = [...windows]
      .reverse()
      .find((candidate) => challenge.finishedAt! >= candidate.startMs);

    if (window) {
      window.matches += 1;
    }
  }

  return windows.map(({ label, matches }) => ({ matches, month: label }));
}
