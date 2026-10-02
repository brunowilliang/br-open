import { getLocalTimeZone, parseDate } from "@internationalized/date";
import { z } from "zod";

import { getBestOfSetValidationError } from "@convex/domains/match/contract";
import { addressSchema } from "@convex/domains/organization/contract";
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
    address: addressSchema,
    allowMultipleEntriesPerType:
      CreateTournamentSchema.shape.allowMultipleEntriesPerType,
    approvalMode: CreateTournamentSchema.shape.approvalMode,
    avatarStorageId: CreateTournamentSchema.shape.avatarStorageId,
    bracketReleaseAt: tournamentFormDateSchema,
    categories: z
      .array(TournamentCategoryFormSchema)
      .min(1, "Crie pelo menos uma categoria."),
    courts: CreateTournamentSchema.shape.courts,
    coverStorageId: CreateTournamentSchema.shape.coverStorageId,
    description: CreateTournamentSchema.shape.description,
    // Obrigatório como o início: o legado sem fim abre com o campo vazio e o
    // SALVAR exige escolher o período.
    endDate: tournamentFormDateSchema,
    matchConfig: TournamentMatchConfigFormSchema,
    name: CreateTournamentSchema.shape.name,
    registrationDeadlineAt: tournamentFormDateSchema,
    startDate: tournamentFormDateSchema,
    visibility: CreateTournamentSchema.shape.visibility,
  })
  .superRefine((value, ctx) => {
    for (const field of ["cep", "street", "number", "city", "state"] as const) {
      if (!value.address[field]?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Campo obrigatório.",
          path: ["address", field],
        });
      }
    }

    if (value.registrationDeadlineAt >= value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O prazo de inscrições deve ser anterior à data de início.",
        path: ["registrationDeadlineAt"],
      });
    }

    // Divulgação entre o prazo e o início: mesmas frases do contrato, senão o
    // submit passaria e o servidor recusaria.
    if (value.bracketReleaseAt) {
      if (value.bracketReleaseAt < value.registrationDeadlineAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "A divulgação da chave não pode ser antes do prazo de inscrições.",
          path: ["bracketReleaseAt"],
        });
      } else if (value.bracketReleaseAt > value.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "A divulgação da chave não pode ser depois do início do torneio.",
          path: ["bracketReleaseAt"],
        });
      }
    }

    // Fim obrigatório: nunca antes do início (no mesmo dia vale).
    if (value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O fim do torneio não pode ser antes do início.",
        path: ["endDate"],
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

/** Opção do DateRangePicker (wire do pacote: JSON com `start`/`end` ISO). */
export type TournamentRangeOption = { label: string; value: string };

/** "13/10/2026" a partir do dia ISO do formulário. */
function formatTournamentDateLabel(date: string): string {
  const [year, month, day] = date.split("-");

  return `${day}/${month}/${year}`;
}

/** "13/10/2026 a 20/10/2026": o rótulo do período no mesmo padrão dos campos. */
export function formatTournamentDateRangeLabel(
  startDate: string,
  endDate: string
): string {
  return `${formatTournamentDateLabel(startDate)} a ${formatTournamentDateLabel(endDate)}`;
}

/** Com as duas datas, o rótulo é o período; só com o início (torneio legado,
 * sem fim) o campo mostra o que existe, sem inventar um fim. */
export function buildTournamentRangeOption(input: {
  endDate?: string;
  startDate?: string;
}): TournamentRangeOption | undefined {
  if (!input.startDate) {
    return undefined;
  }

  if (!input.endDate) {
    return {
      label: `Início ${formatTournamentDateLabel(input.startDate)}`,
      value: JSON.stringify({ end: input.startDate, start: input.startDate }),
    };
  }

  return {
    label: formatTournamentDateRangeLabel(input.startDate, input.endDate),
    value: JSON.stringify({ end: input.endDate, start: input.startDate }),
  };
}

/** Volta do wire do picker para as duas datas do formulário. */
export function parseTournamentRangeValue(value: string): null | {
  endDate: string;
  startDate: string;
} {
  try {
    const parsed = JSON.parse(value) as { end?: unknown; start?: unknown };

    if (typeof parsed.start === "string" && typeof parsed.end === "string") {
      return { endDate: parsed.end, startDate: parsed.start };
    }
  } catch {
    return null;
  }

  return null;
}
