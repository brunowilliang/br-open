import {
  ClipboardIcon,
  GridViewIcon,
  InformationCircleIcon,
  Location06Icon,
  Settings02Icon,
  TennisRacketIcon,
} from "@hugeicons/core-free-icons";
import type { HugeiconsProps } from "@hugeicons/react-native";

export type LeagueFormTabValue =
  | "categories"
  | "courts"
  | "details"
  | "location"
  | "rules"
  | "settings";

export type LeagueFormModePathSegment = "edit" | "new";

export type LeagueFormPathname =
  | "/settings/leagues/[mode]"
  | "/settings/leagues/[mode]/categories"
  | "/settings/leagues/[mode]/courts"
  | "/settings/leagues/[mode]/location"
  | "/settings/leagues/[mode]/rules"
  | "/settings/leagues/[mode]/settings";

export type CreateLeagueFormPathname = LeagueFormPathname;
export type EditLeagueFormPathname = LeagueFormPathname;

export type LeagueFormTabItem = {
  icon: HugeiconsProps["icon"];
  label: string;
  pathname: LeagueFormPathname;
  routeName: string;
  value: LeagueFormTabValue;
};

export const LEAGUE_FORM_TAB_ITEMS: readonly LeagueFormTabItem[] = [
  {
    icon: InformationCircleIcon,
    label: "Detalhes",
    pathname: "/settings/leagues/[mode]",
    routeName: "index",
    value: "details",
  },
  {
    icon: Location06Icon,
    label: "Local",
    pathname: "/settings/leagues/[mode]/location",
    routeName: "location",
    value: "location",
  },
  {
    icon: GridViewIcon,
    label: "Categorias",
    pathname: "/settings/leagues/[mode]/categories",
    routeName: "categories",
    value: "categories",
  },
  {
    icon: TennisRacketIcon,
    label: "Quadras",
    pathname: "/settings/leagues/[mode]/courts",
    routeName: "courts",
    value: "courts",
  },
  {
    icon: ClipboardIcon,
    label: "Regras",
    pathname: "/settings/leagues/[mode]/rules",
    routeName: "rules",
    value: "rules",
  },
  {
    icon: Settings02Icon,
    label: "Ajustes",
    pathname: "/settings/leagues/[mode]/settings",
    routeName: "settings",
    value: "settings",
  },
];

function getLeagueFormTabItem(tab: LeagueFormTabValue): LeagueFormTabItem {
  const item = LEAGUE_FORM_TAB_ITEMS.find((tabItem) => tabItem.value === tab);

  if (!item) {
    throw new Error(`Unknown league form tab: ${tab}`);
  }

  return item;
}

function buildLeagueFormTabRouteNames(): Record<LeagueFormTabValue, string> {
  const routeNames: Partial<Record<LeagueFormTabValue, string>> = {};

  for (const item of LEAGUE_FORM_TAB_ITEMS) {
    routeNames[item.value] = item.routeName;
  }

  return routeNames as Record<LeagueFormTabValue, string>;
}

export const LEAGUE_FORM_TAB_ROUTE_NAMES = buildLeagueFormTabRouteNames();

export function getCreateLeagueFormPathname(
  tab: LeagueFormTabValue
): CreateLeagueFormPathname {
  return getLeagueFormTabItem(tab).pathname;
}

export function getEditLeagueFormPathname(
  tab: LeagueFormTabValue
): EditLeagueFormPathname {
  return getLeagueFormTabItem(tab).pathname;
}

export function getLeagueFormPathname(
  mode: LeagueFormModePathSegment,
  tab: LeagueFormTabValue
): LeagueFormPathname {
  return mode === "new"
    ? getCreateLeagueFormPathname(tab)
    : getEditLeagueFormPathname(tab);
}

export function resolveLeagueFormTabValueFromRouteName(
  routeName: string
): LeagueFormTabValue | null {
  const item = LEAGUE_FORM_TAB_ITEMS.find(
    (tabItem) => tabItem.routeName === routeName
  );

  return item?.value ?? null;
}

/**
 * Display title for a league form tab, resolved from the Expo Router route
 * name (e.g. "categories" -> "Categorias"). Used as the header title on each
 * league form screen instead of the shared bucket title ("Criar/Editar Liga").
 */
export function getLeagueFormTabTitle(routeName: string): string {
  const item = LEAGUE_FORM_TAB_ITEMS.find(
    (tabItem) => tabItem.routeName === routeName
  );

  return item?.label ?? "Liga";
}
