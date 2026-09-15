import { getLocalTimeZone, parseDate } from "@internationalized/date";
import { z } from "zod";

import { getBestOfSetValidationError } from "@convex/domains/league/challenge-rules";
import {
  CreateCategoryInputSchema,
  CreateTournamentSchema,
} from "@convex/domains/tournament/contract";
import { buildCategoryDisplayName } from "@convex/domains/tournament/entry-rules";

/** Melhor de 1, 3 ou 5 — mesmo refine do form da liga (challenge-rules). */
const TournamentMatchConfigFormSchema =
  CreateTournamentSchema.shape.matchConfig.superRefine((value, ctx) => {
    const bestOfSetValidationError = getBestOfSetValidationError(
      value.bestOfSets
    );

    if (!bestOfSetValidationError) {
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: bestOfSetValidationError,
      path: ["bestOfSets"],
    });
  });

/** ISO calendar date (YYYY-MM-DD, local) — what DatePicker emits/edits. */
export type TournamentFormDate = string;

const tournamentFormDateSchema = z
  .string()
  .min(1, "Informe a data.")
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), "Data inválida.");

export type TournamentCategoryPreset = {
  gender: "female" | "male" | "mixed";
  label: string;
  modality: "singles" | "doubles";
  value: string;
};

/** As 5 categorias fixas do produto (checkboxes da aba Categorias). */
export const TOURNAMENT_CATEGORY_PRESETS: readonly TournamentCategoryPreset[] =
  [
    {
      gender: "male",
      label: buildCategoryDisplayName("singles", "male"),
      modality: "singles",
      value: "singles:male",
    },
    {
      gender: "female",
      label: buildCategoryDisplayName("singles", "female"),
      modality: "singles",
      value: "singles:female",
    },
    {
      gender: "male",
      label: buildCategoryDisplayName("doubles", "male"),
      modality: "doubles",
      value: "doubles:male",
    },
    {
      gender: "female",
      label: buildCategoryDisplayName("doubles", "female"),
      modality: "doubles",
      value: "doubles:female",
    },
    {
      gender: "mixed",
      label: buildCategoryDisplayName("doubles", "mixed"),
      modality: "doubles",
      value: "doubles:mixed",
    },
  ];

export function getTournamentCategoryPreset(
  modality: "singles" | "doubles",
  gender: "female" | "male" | "mixed"
) {
  return TOURNAMENT_CATEGORY_PRESETS.find(
    (preset) => preset.modality === modality && preset.gender === gender
  );
}

export const TournamentSchema = z
  .object({
    approvalMode: CreateTournamentSchema.shape.approvalMode,
    avatarStorageId: CreateTournamentSchema.shape.avatarStorageId,
    categories: z
      .array(CreateCategoryInputSchema)
      .min(1, "Selecione pelo menos uma categoria."),
    city: CreateTournamentSchema.shape.city,
    courts: CreateTournamentSchema.shape.courts,
    coverStorageId: CreateTournamentSchema.shape.coverStorageId,
    description: CreateTournamentSchema.shape.description,
    locationNotes: CreateTournamentSchema.shape.locationNotes,
    matchConfig: TournamentMatchConfigFormSchema,
    name: CreateTournamentSchema.shape.name,
    registrationDeadlineAt: tournamentFormDateSchema,
    startDate: tournamentFormDateSchema,
    state: CreateTournamentSchema.shape.state,
    visibility: CreateTournamentSchema.shape.visibility,
  })
  .superRefine((value, ctx) => {
    if (value.registrationDeadlineAt >= value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O prazo de inscrições deve ser anterior à data de início.",
        path: ["registrationDeadlineAt"],
      });
    }
  });

export type TournamentScreenValues = z.infer<typeof TournamentSchema>;

/** ISO calendar date (YYYY-MM-DD) → epoch ms at local midnight. */
export function tournamentDateToEpochMs(date: TournamentFormDate): number {
  return parseDate(date).toDate(getLocalTimeZone()).getTime();
}

/** Epoch ms → ISO calendar date (YYYY-MM-DD) in the local time zone. */
export function epochMsToTournamentDate(ms: number): TournamentFormDate {
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
