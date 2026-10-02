export type TournamentFormTabValue =
  | "categories"
  | "courts"
  | "details"
  | "images"
  | "location"
  | "rules"
  | "settings";

type TournamentFormPathname =
  | "/settings/tournaments/[mode]"
  | "/settings/tournaments/[mode]/categories"
  | "/settings/tournaments/[mode]/courts"
  | "/settings/tournaments/[mode]/images"
  | "/settings/tournaments/[mode]/location"
  | "/settings/tournaments/[mode]/rules"
  | "/settings/tournaments/[mode]/settings";

type TournamentFormTabItem = {
  label: string;
  pathname: TournamentFormPathname;
  routeName: string;
  value: TournamentFormTabValue;
};

export const TOURNAMENT_FORM_TAB_ITEMS: readonly TournamentFormTabItem[] = [
  {
    label: "Detalhes",
    pathname: "/settings/tournaments/[mode]",
    routeName: "index",
    value: "details",
  },
  {
    label: "Imagens",
    pathname: "/settings/tournaments/[mode]/images",
    routeName: "images",
    value: "images",
  },
  {
    label: "Local",
    pathname: "/settings/tournaments/[mode]/location",
    routeName: "location",
    value: "location",
  },
  {
    label: "Categorias",
    pathname: "/settings/tournaments/[mode]/categories",
    routeName: "categories",
    value: "categories",
  },
  {
    label: "Quadras",
    pathname: "/settings/tournaments/[mode]/courts",
    routeName: "courts",
    value: "courts",
  },
  {
    label: "Regras",
    pathname: "/settings/tournaments/[mode]/rules",
    routeName: "rules",
    value: "rules",
  },
  {
    label: "Ajustes",
    pathname: "/settings/tournaments/[mode]/settings",
    routeName: "settings",
    value: "settings",
  },
];

function getTournamentFormTabItem(tab: TournamentFormTabValue) {
  const item = TOURNAMENT_FORM_TAB_ITEMS.find(
    (tabItem) => tabItem.value === tab
  );

  if (!item) {
    throw new Error(`Unknown tournament form tab: ${tab}`);
  }

  return item;
}

/** Href do push para uma seção do wizard no modo create. */
export function getCreateTournamentFormNavigation(tab: TournamentFormTabValue) {
  return {
    params: { mode: "new" as const },
    pathname: getTournamentFormTabItem(tab).pathname,
  };
}

/** Href do push para uma seção do wizard no modo edit (o `tournamentId` viaja
 * junto: a rota é dinâmica). */
export function getEditTournamentFormNavigation(
  tab: TournamentFormTabValue,
  tournamentId: string
) {
  return {
    params: { mode: "edit" as const, tournamentId },
    pathname: getTournamentFormTabItem(tab).pathname,
  };
}
