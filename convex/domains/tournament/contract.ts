import { z } from "zod";

import { CourtsSchema, MatchConfigSchema } from "../match/contract";
import { enumField, requiredString } from "../../utils/contract.zod";

// ---------------------------------------------------------------------------
// Status enums
// ---------------------------------------------------------------------------

export const TournamentStatusOptions = [
  "draft",
  "published",
  "drawn",
  "ongoing",
  "finished",
  "cancelled",
] as const;

export const TournamentModalityOptions = ["singles", "doubles"] as const;

export const TournamentGenderOptions = ["male", "female", "mixed"] as const;

export const TournamentApprovalModeOptions = ["auto", "manual"] as const;

export const TournamentEntryStatusOptions = [
  "pending_partner",
  "pending_approval",
  "awaiting_payment",
  "active",
  "rejected",
  "cancelled",
] as const;

export const TournamentVisibilityOptions = ["public", "private"] as const;

export const DEFAULT_TOURNAMENT_APPROVAL_MODE = "auto" as const;
export const DEFAULT_TOURNAMENT_VISIBILITY = "public" as const;

/** Nasce LIGADO: o organizador DESLIGA para valer um tipo por jogador. */
export const DEFAULT_ALLOW_MULTIPLE_ENTRIES_PER_TYPE = true;

/**
 * Teto de categorias por torneio. As leituras de categoria nao sao paginadas,
 * entao este e o MESMO limite das queries (antes `limit: 10`, que truncava a
 * lista em silencio acima de 10 categorias).
 */
export const MAX_TOURNAMENT_CATEGORIES = 50;

/** Gênero do jogador como gravado em `playerProfile.gender` (rótulos pt-BR). */
export const PLAYER_GENDER_MALE = "Masculino";
export const PLAYER_GENDER_FEMALE = "Feminino";

// ---------------------------------------------------------------------------
// Tournament
// ---------------------------------------------------------------------------

const tournamentNameSchema = requiredString("Informe o nome do torneio.").pipe(
  z.string().min(2, "Informe o nome do torneio.")
);

const tournamentMediaStorageIdSchema = z
  .string()
  .min(1, "Imagem inválida.")
  .nullable();

const tournamentRegistrationDeadlineSchema = z
  .number({
    error: (issue) =>
      issue.input === undefined ? "Informe o prazo de inscrições." : undefined,
  })
  .int();

const tournamentStartDateSchema = z
  .number({
    error: (issue) =>
      issue.input === undefined ? "Informe a data de início." : undefined,
  })
  .int();

export const TournamentSchemaBase = {
  approvalMode: enumField(
    TournamentApprovalModeOptions,
    "Selecione o modo de aprovação."
  ),
  avatarStorageId: tournamentMediaStorageIdSchema,
  city: requiredString("Informe a cidade.").pipe(z.string().min(1)),
  courts: CourtsSchema,
  coverStorageId: tournamentMediaStorageIdSchema,
  description: z.string().trim().optional(),
  locationNotes: z.string().trim().optional(),
  matchConfig: MatchConfigSchema,
  name: tournamentNameSchema,
  registrationDeadlineAt: tournamentRegistrationDeadlineSchema,
  startDate: tournamentStartDateSchema,
  state: requiredString("Informe o estado (UF).").pipe(
    z.string().trim().toUpperCase().length(2, "Use a sigla do estado (ex: SP).")
  ),
  visibility: enumField(
    TournamentVisibilityOptions,
    "Selecione a visibilidade do torneio."
  ),
};

/**
 * Normalizacao canonica do nome da categoria para a unicidade (mesma regra do
 * nome de quadra: trim + caixa baixa pt-BR). "A" e "a" sao o MESMO nome.
 */
export function normalizeCategoryNameKey(name: string) {
  return name.trim().toLocaleLowerCase("pt-BR");
}

/** Indice do PRIMEIRO nome repetido no mesmo tipo (modalidade + genero). */
export function findDuplicateCategoryName(
  categories: ReadonlyArray<{ gender: string; modality: string; name: string }>
): number | null {
  const seen = new Set<string>();
  for (const [index, category] of categories.entries()) {
    const key = `${category.modality}:${category.gender}:${normalizeCategoryNameKey(category.name)}`;
    if (seen.has(key)) {
      return index;
    }
    seen.add(key);
  }
  return null;
}

const categoryNameSchema = requiredString("Informe o nome da categoria.").pipe(
  z.string().min(1)
);

export const CreateCategoryInputSchema = z
  .object({
    entryFeeCents: z.number().int().min(0),
    gender: enumField(TournamentGenderOptions, "Selecione o gênero."),
    maxEntries: z.number().int().min(2).nullable(),
    modality: enumField(TournamentModalityOptions, "Selecione a modalidade."),
    // Nome LIVRE do organizador ("Simples Masculino A", "Amador", "A"): e o
    // rotulo da categoria no app inteiro.
    name: categoryNameSchema,
  })
  .superRefine((value, ctx) => {
    if (value.modality === "singles" && value.gender === "mixed") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A categoria mista só existe nas duplas.",
        path: ["gender"],
      });
    }
  });

/**
 * Payload da edicao: `id` presente = categoria EXISTENTE (o diff casa por ele);
 * ausente = categoria nova.
 */
export const UpdateCategoryInputSchema = CreateCategoryInputSchema.extend({
  id: z.string().min(1, "Categoria inválida.").optional(),
});

type CategoryNameInput = {
  categories: ReadonlyArray<{
    gender: string;
    modality: string;
    name: string;
  }>;
};

/** Mesmo nome no MESMO tipo, ignorando caixa e espacos, nao passa. */
function refineCategoryNames(value: CategoryNameInput, ctx: z.RefinementCtx) {
  const duplicateIndex = findDuplicateCategoryName(value.categories);
  if (duplicateIndex !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Já existe uma categoria com esse nome nesse tipo.",
      path: ["categories", duplicateIndex, "name"],
    });
  }
}

function refineTournamentWindow(
  value: { registrationDeadlineAt: number; startDate: number },
  ctx: z.RefinementCtx
) {
  if (value.registrationDeadlineAt >= value.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "O prazo de inscrições deve ser anterior à data de início.",
      path: ["registrationDeadlineAt"],
    });
  }
}

export const CreateTournamentSchema = z
  .object({
    ...TournamentSchemaBase,
    allowMultipleEntriesPerType: z.boolean(),
    // O teto e o MESMO limite das leituras de categoria; nomes unicos no mesmo
    // tipo, checados de novo contra o que ja esta gravado no diff do servidor.
    categories: z
      .array(CreateCategoryInputSchema)
      .min(1)
      .max(MAX_TOURNAMENT_CATEGORIES),
  })
  .superRefine(refineTournamentWindow)
  .superRefine(refineCategoryNames);

const tournamentIdSchema = z.string().min(1, "Torneio inválido.");

export const TournamentByIdSchema = z.object({
  tournamentId: tournamentIdSchema,
});

export const UpdateTournamentSchema = z
  .object({
    ...TournamentSchemaBase,
    allowMultipleEntriesPerType: z.boolean(),
    categories: z
      .array(UpdateCategoryInputSchema)
      .min(1)
      .max(MAX_TOURNAMENT_CATEGORIES),
    tournamentId: tournamentIdSchema,
  })
  .superRefine(refineTournamentWindow)
  .superRefine(refineCategoryNames);

export const DeleteTournamentSchema = z.object({
  tournamentId: tournamentIdSchema,
});

// ---------------------------------------------------------------------------
// Serialized output schemas
// ---------------------------------------------------------------------------

export const tournamentCategorySchema = z.object({
  entryFeeCents: z.number().int().min(0),
  gender: z.enum(TournamentGenderOptions),
  id: z.string(),
  maxEntries: z.number().int().nullable(),
  modality: z.enum(TournamentModalityOptions),
  name: z.string(),
  tournamentId: z.string(),
});

/**
 * Categoria na leitura do ORGANIZADOR (`management.getById`): soma quantas
 * inscricoes VIVAS a categoria tem. A tela de edicao usa o numero para travar a
 * remocao e explicar o porque antes de tentar.
 */
export const tournamentOrganizerCategorySchema =
  tournamentCategorySchema.extend({
    liveEntryCount: z.number().int().nonnegative(),
  });

/**
 * A categoria exposta ao jogador acrescenta o gate do CALLER. `viewerEligible`
 * é null quando ninguém é barrado (organizador/convidado sem perfil ativo) e
 * false só com `viewerIneligibleReason`: um CHIP de até 2 palavras ("Mulheres"
 * na feminina vista por um homem), nunca a frase longa da recusa, que vive no
 * erro do `create`. Perfil sem gênero (legado) não tem chip.
 */
export const tournamentDiscoveryCategorySchema =
  tournamentCategorySchema.extend({
    viewerEligible: z.boolean().nullable(),
    viewerIneligibleReason: z.string().nullable(),
  });

export const tournamentSchema = z.object({
  allowMultipleEntriesPerType: z.boolean(),
  approvalMode: z.enum(TournamentApprovalModeOptions),
  avatarStorageId: z.string().nullable(),
  avatarUrl: z.string().nullable().optional(),
  city: z.string(),
  courts: CourtsSchema.default([]).catch([]),
  coverStorageId: z.string().nullable(),
  coverUrl: z.string().nullable().optional(),
  createdAt: z.number(),
  description: z.string().nullable().optional(),
  id: z.string(),
  locationNotes: z.string().nullable().optional(),
  matchConfig: MatchConfigSchema,
  name: z.string(),
  registrationDeadlineAt: z.number(),
  startDate: z.number(),
  state: z.string(),
  status: z.enum(TournamentStatusOptions),
  updatedAt: z.number(),
  visibility: z.enum(TournamentVisibilityOptions),
});

export const tournamentDiscoverySchema = tournamentSchema.extend({
  activeEntryCount: z.number().int().nonnegative(),
  // A página de descoberta também mostra os chips de categoria (taxa/vagas)
  // para convidados e jogadores, não só para o organizador.
  categories: z.array(tournamentDiscoveryCategorySchema),
  isTournamentOrganizer: z.boolean(),
  viewerEntryIds: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export const CreateTournamentEntrySchema = z.object({
  categoryId: z.string().min(1, "Categoria inválida."),
  partnerUsername: z
    .string()
    .min(1, "Informe o usuário do parceiro.")
    .optional(),
});

export const TournamentEntryActionSchema = z.object({
  entryId: z.string().min(1, "Inscrição inválida."),
});

export const SetEntrySeedSchema = z.object({
  entryId: z.string().min(1),
  seedRank: z.number().int().min(1).nullable(),
});

// Rodada em que a inscrição entra na chave: só faz sentido junto com um seed
// (o sorteio a posiciona a partir daí) e a validação de completude roda lá.
export const SetEntryRoundSchema = z.object({
  entryId: z.string().min(1),
  entryRound: z.number().int().min(1).nullable(),
});

export const tournamentEntrySchema = z.object({
  categoryId: z.string(),
  createdAt: z.number(),
  createdByUserId: z.string().nullable(),
  entryRound: z.number().int().nullable(),
  id: z.string(),
  partnerUserId: z.string().nullable(),
  playerAId: z.string(),
  playerBId: z.string().nullable(),
  seedRank: z.number().int().nullable(),
  status: z.enum(TournamentEntryStatusOptions),
  updatedAt: z.number(),
});

export const tournamentPlayerCardSchema = z.object({
  avatarUrl: z.string().nullable(),
  fullName: z.string().nullable(),
  nickname: z.string().nullable(),
  playerProfileId: z.string(),
  username: z.string().nullable(),
});

export const tournamentEntryWithPlayersSchema = tournamentEntrySchema.extend({
  playerA: tournamentPlayerCardSchema.nullable(),
  playerB: tournamentPlayerCardSchema.nullable(),
});

export const tournamentMatchScoreSetSchema = z.object({
  aGames: z.number().int().min(0),
  bGames: z.number().int().min(0),
  // Placar manual LIVRE: 'tiebreak' é uma linha avulsa de pontos, sem
  // relação de forma com o set anterior.
  kind: z.enum(["set", "tiebreak", "super_tiebreak"]),
  // Mini-placar de tie-break opcional, no vocabulário A/B; nullish porque o
  // rascunho do cliente traz null enquanto não preenchido.
  tieBreak: z
    .object({
      aPoints: z.number().int().min(0),
      bPoints: z.number().int().min(0),
    })
    .nullish(),
});

export const tournamentMatchScoreSchema = z.object({
  sets: z.array(tournamentMatchScoreSetSchema).min(1),
  // Vencedor EXPLÍCITO do payload: obrigatório só quando as linhas empatam;
  // null quando o placar resolve (derivação por linhas vencidas).
  winnerEntryId: z.string().min(1).nullish(),
});
export const PublishMatchResultSchema = z
  .object({
    matchId: z.string().min(1, "Confronto inválido."),
    score: tournamentMatchScoreSchema,
    walkover: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    // W.O. declara o vencedor SEM placar jogado: exatamente um set
    // placeholder. O guarda de "vencedor é um dos lados" roda em código.
    if (value.walkover && value.score.sets.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Em W.O. não há resultado por sets.",
        path: ["score"],
      });
    }
    // O placeholder do W.O. também não carrega mini-placar de tie-break.
    if (value.walkover && value.score.sets.some((set) => set.tieBreak)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Em W.O. não há resultado por sets.",
        path: ["score"],
      });
    }
  });

// Mesmo payload do publish; o que muda são os guardas de ciclo de vida.
export const EditMatchResultSchema = PublishMatchResultSchema;

export const ScheduleTournamentMatchSchema = z.object({
  courtId: z.string().min(1, "Quadra inválida."),
  endMinute: z.number().int().min(0).max(1440),
  matchDate: z.string().min(1, "Data inválida."),
  matchId: z.string().min(1, "Confronto inválido."),
  startMinute: z.number().int().min(0).max(1440),
});

export const tournamentMatchOccupiedSlotSchema = z.object({
  courtId: z.string().min(1, "Quadra inválida."),
  endMinute: z.number().int(),
  matchDate: z.string().min(1, "Data inválida."),
  matchId: z.string().min(1, "Confronto inválido."),
  startMinute: z.number().int().min(0).max(1440),
});

export type TournamentPlayerCard = z.infer<typeof tournamentPlayerCardSchema>;
export type TournamentEntryWithPlayers = z.infer<
  typeof tournamentEntryWithPlayersSchema
>;

export const SwapBracketSlotsSchema = z.object({
  categoryId: z.string().min(1, "Categoria inválida."),
  // O movimento endereça duas coordenadas (rodada, slot, lado); rodadas
  // iguais = troca na mesma rodada, diferentes = só na chave sorteada.
  roundA: z.number().int().min(1),
  roundB: z.number().int().min(1),
  sideA: z.enum(["a", "b"]),
  sideB: z.enum(["a", "b"]),
  slotA: z.number().int().min(0),
  slotB: z.number().int().min(0),
  tournamentId: tournamentIdSchema,
});

export const tournamentMatchSchema = z.object({
  categoryId: z.string(),
  courtId: z.string().nullable(),
  createdAt: z.number(),
  endMinute: z.number().int().nullable(),
  entryAId: z.string().nullable(),
  entryBId: z.string().nullable(),
  id: z.string(),
  matchDate: z.string().nullable(),
  round: z.number().int().min(1),
  rowVersion: z.number().int(),
  scheduledById: z.string().nullable(),
  score: tournamentMatchScoreSchema.nullable(),
  slotInRound: z.number().int().min(0),
  startMinute: z.number().int().nullable(),
  status: z.enum(["pending", "scheduled", "finished", "vacant", "walkover"]),
  updatedAt: z.number(),
  walkover: z.boolean(),
  winnerEntryId: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Acerto do confronto entre os dois lados
// ---------------------------------------------------------------------------
// Um lado PROPÕE, o outro aceita ou propõe outro. Com o aceite dos dois o
// confronto fica agendado (canal `schedule`) ou publicado (canal `score`), com o
// mesmo efeito da escrita do organizador. O estado do canal é FECHADO e cresce
// por adição: `idle` (sem proposta vigente), `negotiating` (proposta esperando o
// outro lado) e `agreed` (fechado pelos dois).

export const MatchAgreementChannelOptions = ["schedule", "score"] as const;

export const MatchAgreementEventKindOptions = [
  "proposed",
  "accepted",
  "declined",
  "cancelled",
  "reopened",
  "overridden",
  "closed",
] as const;

export const MatchAgreementStateOptions = [
  "idle",
  "negotiating",
  "agreed",
] as const;

export const MatchAgreementSideOptions = ["a", "b"] as const;

/** Lado no histórico: `organizer` só aparece quando ele age por cima. */
export const MatchAgreementActorSideOptions = ["a", "b", "organizer"] as const;

export const MatchAgreementActionSchema = z.object({
  matchId: z.string().min(1, "Confronto inválido."),
});

export const ProposeMatchScheduleSchema = z.object({
  // Null quando o torneio não tem quadra cadastrada: sem quadra o acerto fica em
  // data e horário, e não há janela para conflitar.
  courtId: z.string().min(1).nullable(),
  endMinute: z.number().int().min(0).max(1440),
  matchDate: z.string().min(1, "Data inválida."),
  matchId: z.string().min(1, "Confronto inválido."),
  startMinute: z.number().int().min(0).max(1440),
});

export const matchScheduleProposalSchema = z.object({
  courtId: z.string().nullable(),
  endMinute: z.number().int(),
  matchDate: z.string(),
  startMinute: z.number().int(),
});

export const matchScoreProposalSchema = z.object({
  score: tournamentMatchScoreSchema,
  walkover: z.boolean(),
});

const matchAgreementChannelBaseSchema = z.object({
  agreedAt: z.number().nullable(),
  proposedAt: z.number().nullable(),
  // A leitura é sempre de UMA das partes: o cliente não compara id de usuário.
  proposedByMe: z.boolean(),
  proposedBySide: z.enum(MatchAgreementSideOptions).nullable(),
  state: z.enum(MatchAgreementStateOptions),
});

export const matchScheduleAgreementSchema =
  matchAgreementChannelBaseSchema.extend({
    proposal: matchScheduleProposalSchema.nullable(),
  });

export const matchScoreAgreementSchema = matchAgreementChannelBaseSchema.extend(
  {
    proposal: matchScoreProposalSchema.nullable(),
  }
);

export const matchAgreementsSchema = z.object({
  matchId: z.string(),
  schedule: matchScheduleAgreementSchema,
  score: matchScoreAgreementSchema,
});

/** Confronto do PRÓPRIO jogador: nada do resto da chave entra neste payload. */
export const playerMatchSchema = z.object({
  agreements: matchAgreementsSchema,
  match: tournamentMatchSchema,
  mySide: z.enum(MatchAgreementSideOptions),
  /** Última rodada da categoria: mesmo par do rótulo de estágio do app. */
  totalRounds: z.number().int().min(1),
});

export const matchAgreementEventSchema = z.object({
  actorName: z.string(),
  actorSide: z.enum(MatchAgreementActorSideOptions),
  channel: z.enum(MatchAgreementChannelOptions),
  createdAt: z.number(),
  id: z.string(),
  kind: z.enum(MatchAgreementEventKindOptions),
  schedule: matchScheduleProposalSchema.nullable(),
  score: matchScoreProposalSchema.nullable(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MatchAgreementActorSide =
  (typeof MatchAgreementActorSideOptions)[number];
export type MatchAgreementChannel =
  (typeof MatchAgreementChannelOptions)[number];
export type MatchAgreementEvent = z.infer<typeof matchAgreementEventSchema>;
export type MatchAgreementEventKind =
  (typeof MatchAgreementEventKindOptions)[number];
export type MatchAgreementSide = (typeof MatchAgreementSideOptions)[number];
export type MatchAgreementState = (typeof MatchAgreementStateOptions)[number];
export type MatchAgreements = z.infer<typeof matchAgreementsSchema>;
export type MatchScoreProposal = z.infer<typeof matchScoreProposalSchema>;
export type MatchScheduleProposal = z.infer<typeof matchScheduleProposalSchema>;
export type PlayerMatch = z.infer<typeof playerMatchSchema>;
export type TournamentStatus = (typeof TournamentStatusOptions)[number];
export type TournamentModality = (typeof TournamentModalityOptions)[number];
export type TournamentGender = (typeof TournamentGenderOptions)[number];
export type TournamentEntryStatus =
  (typeof TournamentEntryStatusOptions)[number];
export type Tournament = z.infer<typeof tournamentSchema>;
export type TournamentCategory = z.infer<typeof tournamentCategorySchema>;
export type TournamentOrganizerCategory = z.infer<
  typeof tournamentOrganizerCategorySchema
>;
export type TournamentDiscovery = z.infer<typeof tournamentDiscoverySchema>;
export type TournamentEntry = z.infer<typeof tournamentEntrySchema>;
export type TournamentMatch = z.infer<typeof tournamentMatchSchema>;
export type TournamentMatchScore = z.infer<typeof tournamentMatchScoreSchema>;
export type TournamentMatchScoreSet = z.infer<
  typeof tournamentMatchScoreSetSchema
>;
export type CreateTournamentInput = z.infer<typeof CreateTournamentSchema>;
export type UpdateTournamentInput = z.infer<typeof UpdateTournamentSchema>;
