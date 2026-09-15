const COMBINING_MARKS_REGEX = /[\u0300-\u036f]/g;
const WHITESPACE_REGEX = /\s+/g;

type SearchableTournament = {
  city?: null | string;
  description?: null | string;
  name?: null | string;
  state?: null | string;
};

export function normalizeTournamentSearchQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS_REGEX, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(WHITESPACE_REGEX, " ");
}

function buildTournamentSearchText(tournament: SearchableTournament) {
  return normalizeTournamentSearchQuery(
    [tournament.name, tournament.city, tournament.state, tournament.description]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join(" ")
  );
}

export function filterTournamentsBySearchQuery<
  TTournament extends SearchableTournament,
>(tournaments: readonly TTournament[], query: string) {
  const normalizedQuery = normalizeTournamentSearchQuery(query);

  if (!normalizedQuery) {
    return [...tournaments];
  }

  const queryParts = normalizedQuery.split(WHITESPACE_REGEX);

  return tournaments.filter((tournament) => {
    const searchText = buildTournamentSearchText(tournament);

    return queryParts.every((part) => searchText.includes(part));
  });
}
