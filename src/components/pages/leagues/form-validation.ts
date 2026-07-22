import type { FieldErrors } from "react-hook-form";

import type { LeagueFormTabValue } from "@/lib/leagues/league-form-navigation";

import type { LeagueScreenValues } from "./form-schema";

export type LeagueScreenTab = LeagueFormTabValue;

type LeagueFormInvalidSubmission = {
  description: string;
  label: string;
  tab: LeagueScreenTab;
};

type LeagueFormErrorGroup = {
  fallbackDescription: string;
  fields: Array<keyof LeagueScreenValues>;
  label: string;
  tab: LeagueScreenTab;
};

const LEAGUE_FORM_ERROR_GROUPS: LeagueFormErrorGroup[] = [
  {
    fallbackDescription: "Revise os campos destacados da liga.",
    fields: ["name", "description", "coverStorageId", "avatarStorageId"],
    label: "Detalhes incompletos",
    tab: "details",
  },
  {
    fallbackDescription: "Informe a cidade e o estado da liga.",
    fields: ["city", "state", "locationNotes"],
    label: "Localização incompleta",
    tab: "location",
  },
  {
    fallbackDescription: "Adicione pelo menos uma categoria.",
    fields: ["categories"],
    label: "Categorias incompletas",
    tab: "categories",
  },
  {
    fallbackDescription: "Revise as regras marcadas antes de salvar.",
    fields: ["ruleConfig"],
    label: "Regras incompletas",
    tab: "rules",
  },
  {
    fallbackDescription: "Revise as quadras marcadas antes de salvar.",
    fields: ["courts"],
    label: "Quadras incompletas",
    tab: "courts",
  },
  {
    fallbackDescription: "Revise as configurações da liga.",
    fields: [
      "visibility",
      "maxPlayers",
      "monthlyPriceCents",
      "priceBillingInterval",
    ],
    label: "Configurações incompletas",
    tab: "settings",
  },
];

function getFirstErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if (
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  const values = Array.isArray(error)
    ? error
    : Object.values(error as Record<string, unknown>);

  for (const value of values) {
    const message = getFirstErrorMessage(value);

    if (message) {
      return message;
    }
  }

  return null;
}

export function resolveLeagueFormInvalidSubmission(
  errors: FieldErrors<LeagueScreenValues>
): LeagueFormInvalidSubmission {
  for (const group of LEAGUE_FORM_ERROR_GROUPS) {
    for (const field of group.fields) {
      const fieldError = errors[field];

      if (!fieldError) {
        continue;
      }

      return {
        description:
          getFirstErrorMessage(fieldError) ?? group.fallbackDescription,
        label: group.label,
        tab: group.tab,
      };
    }
  }

  return {
    description: "Revise os campos destacados antes de salvar.",
    label: "Campos incompletos",
    tab: "details",
  };
}
