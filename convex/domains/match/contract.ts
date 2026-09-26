import { z } from "zod";

import { requiredNumber, requiredString } from "../../utils/contract.zod";

export const MatchScoringModeOptions = ["advantage", "no_advantage"] as const;

export const MatchScoreSetKindOptions = [
  "set",
  // Linha avulsa de tie-break — pontos livres, sem relação com o set
  // anterior (o placar manual é LIVRE).
  "tiebreak",
  "super_tiebreak",
] as const;

export const CourtDayKeys = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

const THIRTY_MINUTES = 30;
const MINUTES_PER_DAY = 24 * 60;

export const DEFAULT_MATCH_CONFIG = {
  bestOfSets: 3,
  defaultDurationMinutes: 90,
  gamesPerSet: 6,
  hasTieBreak: true,
  scoringMode: "advantage",
  setMustWinByTwoGames: true,
  tieBreakMustWinByTwo: true,
  tieBreakPoints: 7,
} as const;

export type CourtDayKey = (typeof CourtDayKeys)[number];
export type CourtDay = CourtDayKey;

type CourtRangeValue = {
  endMinute: number;
  startMinute: number;
};

export const EMPTY_COURT_AVAILABILITY = {
  fri: [],
  mon: [],
  sat: [],
  sun: [],
  thu: [],
  tue: [],
  wed: [],
} satisfies Record<CourtDayKey, CourtRangeValue[]>;

function hasOverlap(ranges: CourtRangeValue[]) {
  const sortedRanges = [...ranges].sort(
    (left, right) => left.startMinute - right.startMinute
  );

  for (let index = 1; index < sortedRanges.length; index += 1) {
    const previousRange = sortedRanges[index - 1];
    const currentRange = sortedRanges[index];

    if (currentRange.startMinute < previousRange.endMinute) {
      return true;
    }
  }

  return false;
}

const CourtRangeSchema = z
  .object({
    endMinute: z
      .number({
        error: "Informe um horário final válido.",
      })
      .int("Informe um horário final válido.")
      .min(0, "Informe um horário final válido.")
      .max(MINUTES_PER_DAY, "Informe um horário final válido."),
    startMinute: z
      .number({
        error: "Informe um horário inicial válido.",
      })
      .int("Informe um horário inicial válido.")
      .min(0, "Informe um horário inicial válido.")
      .max(MINUTES_PER_DAY, "Informe um horário inicial válido."),
  })
  .superRefine((value, ctx) => {
    if (value.startMinute % THIRTY_MINUTES !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Os horários devem seguir intervalos de 30 minutos.",
        path: ["startMinute"],
      });
    }

    if (value.endMinute % THIRTY_MINUTES !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Os horários devem seguir intervalos de 30 minutos.",
        path: ["endMinute"],
      });
    }

    if (value.startMinute >= value.endMinute) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O horário inicial deve ser menor que o horário final.",
        path: ["endMinute"],
      });
    }
  });

const CourtAvailabilitySchema = z
  .object({
    fri: z.array(CourtRangeSchema),
    mon: z.array(CourtRangeSchema),
    sat: z.array(CourtRangeSchema),
    sun: z.array(CourtRangeSchema),
    thu: z.array(CourtRangeSchema),
    tue: z.array(CourtRangeSchema),
    wed: z.array(CourtRangeSchema),
  })
  .superRefine((value, ctx) => {
    for (const dayKey of CourtDayKeys) {
      const dayRanges = value[dayKey];

      if (!hasOverlap(dayRanges)) {
        continue;
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Os horários não podem se sobrepor no mesmo dia.",
        path: [dayKey],
      });
    }
  });

export const CourtSchema = z.object({
  availability: CourtAvailabilitySchema,
  id: z.string().min(1, "Quadra inválida."),
  name: requiredString("Informe o nome da quadra.").pipe(
    z.string().trim().min(1, "Informe o nome da quadra.")
  ),
});

export const CourtsSchema = z.array(CourtSchema).superRefine((value, ctx) => {
  const seenCourtNames = new Map<string, number>();

  for (const [index, court] of value.entries()) {
    const normalizedName = court.name.trim().toLocaleLowerCase("pt-BR");

    if (!normalizedName) {
      continue;
    }

    const previousIndex = seenCourtNames.get(normalizedName);

    if (previousIndex !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Já existe uma quadra com esse nome.",
        path: [index, "name"],
      });
      continue;
    }

    seenCourtNames.set(normalizedName, index);
  }
});
export const SUPPORTED_BEST_OF_SET_COUNTS = [1, 3, 5] as const;

export function getBestOfSetValidationError(bestOfSets: number) {
  return SUPPORTED_BEST_OF_SET_COUNTS.includes(
    bestOfSets as (typeof SUPPORTED_BEST_OF_SET_COUNTS)[number]
  )
    ? null
    : "Escolha melhor de 1, 3 ou 5 sets.";
}

export const SUPPORTED_TIE_BREAK_POINTS = [7, 10] as const;

export function getTieBreakPointsValidationError(points: number) {
  return SUPPORTED_TIE_BREAK_POINTS.includes(
    points as (typeof SUPPORTED_TIE_BREAK_POINTS)[number]
  )
    ? null
    : "Escolha 7 ou 10 pontos no tie-break.";
}

export const MatchConfigSchema = z
  .object({
    bestOfSets: requiredNumber(
      "Informe quantos sets a partida pode ter.",
      "Informe uma quantidade de sets valida."
    ).min(1, "Informe uma quantidade de sets valida."),
    defaultDurationMinutes: requiredNumber(
      "Informe a duracao padrao da partida.",
      "Informe uma duracao valida."
    ).min(1, "Informe uma duracao valida."),
    gamesPerSet: requiredNumber(
      "Informe quantos games cada set deve ter.",
      "Informe uma quantidade de games valida."
    ).min(1, "Informe uma quantidade de games valida."),
    hasTieBreak: z.boolean(),
    scoringMode: z.enum(MatchScoringModeOptions),
    setMustWinByTwoGames: z.boolean(),
    tieBreakMustWinByTwo: z.boolean(),
    tieBreakPoints: requiredNumber(
      "Informe quantos pontos o tie-break deve ter.",
      "Informe uma pontuacao de tie-break valida."
    ).min(1, "Informe uma pontuacao de tie-break valida."),
  })
  .superRefine((value, ctx) => {
    const bestOfSetError = getBestOfSetValidationError(value.bestOfSets);

    if (bestOfSetError) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: bestOfSetError,
        path: ["bestOfSets"],
      });
    }

    const tieBreakPointsError = getTieBreakPointsValidationError(
      value.tieBreakPoints
    );

    if (tieBreakPointsError) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: tieBreakPointsError,
        path: ["tieBreakPoints"],
      });
    }
  });

const participantIdSchema = z.string().min(1, "Solicitação inválida.");

const MatchScoreSetSchema = z.object({
  challengedGames: z.number().int().min(0),
  challengerGames: z.number().int().min(0),
  kind: z.enum(MatchScoreSetKindOptions),
  // Optional tie-break mini-score for sets decided in a tie-break (7x6 with TB
  // 7-3): validation only applies when present, super tie-break sets never carry
  // it and client drafts carry null when unset — hence `nullish()`.
  tieBreak: z
    .object({
      challengedPoints: z.number().int().min(0),
      challengerPoints: z.number().int().min(0),
    })
    .nullish(),
});

export const MatchScoreSchema = z
  .object({
    sets: z.array(MatchScoreSetSchema).min(1),
    // A W.O. (walkover) declares a winner without a played score: it carries
    // exactly one all-zero placeholder set (same convention as the tournament's
    // PublishMatchResultSchema); absent for played scores.
    walkover: z.boolean().optional(),
    // Vencedor EXPLÍCITO do payload — obrigatório só quando as linhas
    // empatam (o placar não decide); null quando o placar resolve. A
    // validação (resolveMatchScoreOutcome) garante que o resultado
    // final tem exatamente 1 vencedor.
    winnerMembershipId: participantIdSchema.nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.walkover && value.sets.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Em W.O. não há resultado por sets.",
        path: ["sets"],
      });
    }
  });

export type Court = z.infer<typeof CourtSchema>;
export type MatchConfig = z.infer<typeof MatchConfigSchema>;
export type MatchScore = z.infer<typeof MatchScoreSchema>;
export type MatchScoreSet = z.infer<typeof MatchScoreSetSchema>;
