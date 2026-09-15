import type { FieldErrors } from "react-hook-form";

import {
  resolveFormInvalidSubmission,
  type FormErrorGroup,
  type FormInvalidSubmission,
} from "@/lib/forms/invalid-submission";
import type { LeagueFormTabValue } from "@/lib/leagues/league-form-navigation";

import type { LeagueScreenValues } from "./form-schema";

export type LeagueScreenTab = LeagueFormTabValue;

type LeagueFormInvalidSubmission = FormInvalidSubmission<LeagueScreenTab>;

type LeagueFormErrorGroup = FormErrorGroup<LeagueScreenValues, LeagueScreenTab>;

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

export function resolveLeagueFormInvalidSubmission(
  errors: FieldErrors<LeagueScreenValues>
): LeagueFormInvalidSubmission {
  return resolveFormInvalidSubmission({
    errors,
    fallback: {
      description: "Revise os campos destacados antes de salvar.",
      label: "Campos incompletos",
      tab: "details",
    },
    groups: LEAGUE_FORM_ERROR_GROUPS,
    // Campo com erro sem mensagem usa o fallback do grupo (paridade com o
    // comportamento original da liga).
    stopOnSilentError: true,
  });
}
