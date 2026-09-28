import { getLocalTimeZone, parseDate } from "@internationalized/date";
import { z } from "zod";

import { getBestOfSetValidationError } from "@convex/domains/match/contract";
import {
  CreateTournamentSchema,
  UpdateCategoryInputSchema,
} from "@convex/domains/tournament/contract";

import {
  CATEGORY_NAME_DUPLICATE_MESSAGE,
  collectDuplicateCategoryIds,
} from "@/lib/tournaments/category-editor-derived";

/** Melhor de 1, 3 ou 5 — o refine vem do contrato de partida (`getBestOfSetValidationError`). */
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

/** Categoria no editor: `id` local identifica a linha no diff do servidor;
 * `liveEntryCount` chega só na edição e sustenta as travas. */
const TournamentCategoryFormSchema = UpdateCategoryInputSchema.safeExtend({
  id: z.string().min(1, "Categoria inválida."),
  liveEntryCount: z.number().int().nonnegative().optional(),
});

export const TournamentSchema = z
  .object({
    allowMultipleEntriesPerType:
      CreateTournamentSchema.shape.allowMultipleEntriesPerType,
    approvalMode: CreateTournamentSchema.shape.approvalMode,
    avatarStorageId: CreateTournamentSchema.shape.avatarStorageId,
    categories: z
      .array(TournamentCategoryFormSchema)
      .min(1, "Crie pelo menos uma categoria."),
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

    // O card já marca as linhas duplicadas; aqui o SALVAR também barra (mesma
    // frase do refine do contrato), senão o submit passaria e o servidor recusaria.
    const duplicateIds = new Set(collectDuplicateCategoryIds(value.categories));

    if (duplicateIds.size > 0) {
      value.categories.forEach((category, index) => {
        if (!duplicateIds.has(category.id)) {
          return;
        }

        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: CATEGORY_NAME_DUPLICATE_MESSAGE,
          path: ["categories", index, "name"],
        });
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
