import {
  ClipboardIcon,
  GridViewIcon,
  InformationCircleIcon,
  Location06Icon,
  Settings02Icon,
  TennisRacketIcon,
} from "@hugeicons/core-free-icons";
import type { HugeiconsProps } from "@hugeicons/react-native";

export type TournamentFormTabValue =
  | "categories"
  | "courts"
  | "details"
  | "location"
  | "rules"
  | "settings";

export type TournamentFormModePathSegment = "edit" | "new";

export type TournamentFormPathname =
  | "/settings/tournaments/[mode]"
  | "/settings/tournaments/[mode]/categories"
  | "/settings/tournaments/[mode]/courts"
  | "/settings/tournaments/[mode]/location"
  | "/settings/tournaments/[mode]/rules"
  | "/settings/tournaments/[mode]/settings";

export type TournamentFormTabItem = {
  icon: HugeiconsProps["icon"];
  label: string;
  pathname: TournamentFormPathname;
  routeName: string;
  value: TournamentFormTabValue;
};

export const TOURNAMENT_FORM_TAB_ITEMS: readonly TournamentFormTabItem[] = [
  {
    icon: InformationCircleIcon,
    label: "Detalhes",
    pathname: "/settings/tournaments/[mode]",
    routeName: "index",
    value: "details",
  },
  {
    icon: Location06Icon,
    label: "Local",
    pathname: "/settings/tournaments/[mode]/location",
    routeName: "location",
    value: "location",
  },
  {
    icon: GridViewIcon,
    label: "Categorias",
    pathname: "/settings/tournaments/[mode]/categories",
    routeName: "categories",
    value: "categories",
  },
  {
    icon: TennisRacketIcon,
    label: "Quadras",
    pathname: "/settings/tournaments/[mode]/courts",
    routeName: "courts",
    value: "courts",
  },
  {
    icon: ClipboardIcon,
    label: "Regras",
    pathname: "/settings/tournaments/[mode]/rules",
    routeName: "rules",
    value: "rules",
  },
  {
    icon: Settings02Icon,
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

function buildTournamentFormTabRouteNames(): Record<
  TournamentFormTabValue,
  string
> {
  const routeNames: Partial<Record<TournamentFormTabValue, string>> = {};

  for (const item of TOURNAMENT_FORM_TAB_ITEMS) {
    routeNames[item.value] = item.routeName;
  }

  return routeNames as Record<TournamentFormTabValue, string>;
}

export const TOURNAMENT_FORM_TAB_ROUTE_NAMES =
  buildTournamentFormTabRouteNames();

export function getCreateTournamentFormPathname(
  tab: TournamentFormTabValue
): TournamentFormPathname {
  return getTournamentFormTabItem(tab).pathname;
}

export function getEditTournamentFormPathname(
  tab: TournamentFormTabValue
): TournamentFormPathname {
  return getTournamentFormTabItem(tab).pathname;
}

export function getTournamentFormPathname(
  mode: TournamentFormModePathSegment,
  tab: TournamentFormTabValue
): TournamentFormPathname {
  return mode === "new"
    ? getCreateTournamentFormPathname(tab)
    : getEditTournamentFormPathname(tab);
}

export function resolveTournamentFormTabValueFromRouteName(
  routeName: string
): TournamentFormTabValue | null {
  const item = TOURNAMENT_FORM_TAB_ITEMS.find(
    (tabItem) => tabItem.routeName === routeName
  );

  return item?.value ?? null;
}

/**
 * Display title for a tournament form tab, resolved from the Expo Router route
 * name (e.g. "categories" -> "Categorias"). Same pattern as the league wizard.
 */
export function getTournamentFormTabTitle(routeName: string) {
  const value = resolveTournamentFormTabValueFromRouteName(routeName);

  return value ? getTournamentFormTabItem(value).label : "Torneio";
}
