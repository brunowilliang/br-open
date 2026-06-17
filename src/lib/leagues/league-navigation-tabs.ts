import type { LeagueDetailsAccess } from "./league-details-derived";

export type LeagueNavigationTabValue =
  | "challenges"
  | "overview"
  | "ranking"
  | "requests";

export type LeagueNavigationTabItem = {
  badgeCount: number;
  label: string;
  value: LeagueNavigationTabValue;
};

export function buildLeagueNavigationTabItems(input: {
  access: LeagueDetailsAccess;
  challengeActionCount: number;
  requestActionCount: number;
}): LeagueNavigationTabItem[] {
  const items: LeagueNavigationTabItem[] = [
    {
      badgeCount: 0,
      label: "Overview",
      value: "overview",
    },
  ];

  if (input.access.canOpenRanking) {
    items.push({
      badgeCount: 0,
      label: "Ranking",
      value: "ranking",
    });
  }

  if (input.access.canOpenChallenges) {
    items.push({
      badgeCount: normalizeTabBadgeCount(input.challengeActionCount),
      label: "Desafios",
      value: "challenges",
    });
  }

  if (input.access.canOpenRequests) {
    items.push({
      badgeCount: normalizeTabBadgeCount(input.requestActionCount),
      label: "Solicitações",
      value: "requests",
    });
  }

  return items.length > 1 ? items : [];
}

export function formatLeagueNavigationBadgeCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

export function resolveLeagueNavigationTabValue(
  pathname: string
): LeagueNavigationTabValue | null {
  const segments = pathname.split("/").filter(Boolean);
  const leagueSegmentIndex = segments.indexOf("leagues");
  const routeSegment = segments[leagueSegmentIndex + 2];

  switch (routeSegment) {
    case undefined:
      return "overview";
    case "challenges":
    case "ranking":
    case "requests":
      return routeSegment;
    default:
      return null;
  }
}

function normalizeTabBadgeCount(count: number) {
  return Math.max(0, Math.trunc(count));
}
