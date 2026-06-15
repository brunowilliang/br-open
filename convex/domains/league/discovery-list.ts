const COMBINING_MARKS_REGEX = /[\u0300-\u036f]/g;
const WHITESPACE_REGEX = /\s+/g;

type SearchableLeague = {
  categories?: readonly string[];
  city?: null | string;
  description?: null | string;
  name?: null | string;
  state?: null | string;
};

type LeagueMembershipLike = {
  leagueId: string;
  status: string;
};

export function normalizeLeagueSearchQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS_REGEX, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(WHITESPACE_REGEX, " ");
}

function buildLeagueSearchText(league: SearchableLeague) {
  return normalizeLeagueSearchQuery(
    [
      league.name,
      league.city,
      league.state,
      league.description,
      ...(league.categories ?? []),
    ]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join(" ")
  );
}

export function filterLeaguesBySearchQuery<TLeague extends SearchableLeague>(
  leagues: readonly TLeague[],
  query: string
) {
  const normalizedQuery = normalizeLeagueSearchQuery(query);

  if (!normalizedQuery) {
    return [...leagues];
  }

  const queryParts = normalizedQuery.split(WHITESPACE_REGEX);

  return leagues.filter((league) => {
    const searchText = buildLeagueSearchText(league);

    return queryParts.every((part) => searchText.includes(part));
  });
}

export function getActiveMembershipLeagueIds(
  memberships: readonly LeagueMembershipLike[]
) {
  const leagueIds = new Set<string>();

  for (const membership of memberships) {
    if (membership.status === "active") {
      leagueIds.add(membership.leagueId);
    }
  }

  return leagueIds;
}
