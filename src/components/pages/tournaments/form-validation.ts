import type { FieldErrors } from "react-hook-form";

import {
  resolveFormInvalidSubmission,
  type FormErrorGroup,
  type FormInvalidSubmission,
} from "@/lib/forms/invalid-submission";
import type { TournamentFormTabValue } from "@/lib/tournaments/tournament-form-navigation";

import type { TournamentScreenValues } from "./form-schema";

export type TournamentScreenTab = TournamentFormTabValue;

export type TournamentFormInvalidSubmission =
  FormInvalidSubmission<TournamentScreenTab>;

type TournamentFormErrorGroup = FormErrorGroup<
  TournamentScreenValues,
  TournamentScreenTab
>;

const TOURNAMENT_FORM_ERROR_GROUPS: TournamentFormErrorGroup[] = [
  {
    fallbackDescription: "Confira os detalhes do torneio.",
    fields: [
      "name",
      "description",
      "startDate",
      "registrationDeadlineAt",
      "avatarStorageId",
      "coverStorageId",
    ],
    label: "Detalhes incompletos",
    tab: "details",
  },
  {
    fallbackDescription: "Confira o local do torneio.",
    fields: ["city", "state", "locationNotes"],
    label: "Local incompleto",
    tab: "location",
  },
  {
    fallbackDescription: "Selecione pelo menos uma categoria.",
    fields: ["categories"],
    label: "Categorias incompletas",
    tab: "categories",
  },
  {
    fallbackDescription: "Confira as quadras e os horários.",
    fields: ["courts"],
    label: "Quadras incompletas",
    tab: "courts",
  },
  {
    fallbackDescription: "Confira as regras das partidas.",
    fields: ["matchConfig"],
    label: "Regras incompletas",
    tab: "rules",
  },
  {
    fallbackDescription: "Confira as configurações do torneio.",
    fields: ["visibility", "approvalMode"],
    label: "Configurações incompletas",
    tab: "settings",
  },
];

export function resolveTournamentFormInvalidSubmission(
  errors: FieldErrors<TournamentScreenValues>
): TournamentFormInvalidSubmission {
  return resolveFormInvalidSubmission({
    errors,
    fallback: {
      description: "Confira os campos antes de salvar.",
      label: "Formulário incompleto",
      tab: "details",
    },
    groups: TOURNAMENT_FORM_ERROR_GROUPS,
    // Campos com erro sem mensagem seguem para o próximo candidato.
    stopOnSilentError: false,
  });
}
