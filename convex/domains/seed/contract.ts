import { z } from "zod";

export const SEED_EMAIL_PREFIX = "seed+";
export const SEED_EMAIL_DOMAIN = "bropen.local";

export const SeedPreviewSchema = z.object({
  primaryUserEmail: z.string().email().optional(),
  reset: z.boolean().optional(),
});

export const seedPreviewResultSchema = z.object({
  playerProfilesCreated: z.number().int().nonnegative(),
  primaryUserLinked: z.boolean(),
  resetApplied: z.boolean(),
  skipped: z.boolean(),
  usersCreated: z.number().int().nonnegative(),
});

export type SeedPreviewInput = z.infer<typeof SeedPreviewSchema>;
export type SeedPreviewResult = z.infer<typeof seedPreviewResultSchema>;

/**
 * Cenario de PENDENCIAS: cria, na conta do email informado, o estado que faz a
 * home mostrar o maximo de kinds das duas superficies. O email e obrigatorio de
 * proposito — o cenario nunca roda "na conta errada" por engano.
 */
export const PendencyScenarioSchema = z.object({
  primaryUserEmail: z.string().email(),
});

export const pendencyScenarioResultSchema = z.object({
  categoriesCreated: z.number().int().nonnegative(),
  entriesCreated: z.number().int().nonnegative(),
  organizationId: z.string(),
  playerProfileId: z.string(),
  playerProfilesCreated: z.number().int().nonnegative(),
  /** Plantio na organizacao que o alvo JA usa. */
  primaryEntriesCreated: z.number().int().nonnegative(),
  primaryOrganizationsTouched: z.number().int().nonnegative(),
  tournamentsCreated: z.number().int().nonnegative(),
  userId: z.string(),
  usersCreated: z.number().int().nonnegative(),
});

export type PendencyScenarioInput = z.infer<typeof PendencyScenarioSchema>;
export type PendencyScenarioResult = z.infer<
  typeof pendencyScenarioResultSchema
>;

/**
 * Cenario de DUPLAS: planta, na organizacao que o email informado ja gerencia,
 * um torneio publicado so com duplas masculinas e femininas. O email e
 * obrigatorio de proposito — o cenario nunca roda "na conta errada" por engano.
 */
export const DoublesScenarioSchema = z.object({
  primaryUserEmail: z.string().email(),
});

/** Totais LIDOS do banco depois do plantio: repetir a execucao nao os muda. */
export const doublesScenarioCategoryResultSchema = z.object({
  activePairs: z.number().int().nonnegative(),
  displayName: z.string(),
  gender: z.string(),
  invitePairs: z.number().int().nonnegative(),
});

export const doublesScenarioResultSchema = z.object({
  activePairsCreated: z.number().int().nonnegative(),
  categories: z.array(doublesScenarioCategoryResultSchema),
  categoriesCreated: z.number().int().nonnegative(),
  invitePairsCreated: z.number().int().nonnegative(),
  organizationId: z.string(),
  organizationName: z.string(),
  organizationsTouched: z.number().int().nonnegative(),
  playerProfilesCreated: z.number().int().nonnegative(),
  tournamentId: z.string(),
  tournamentName: z.string(),
  tournamentsCreated: z.number().int().nonnegative(),
  usersCreated: z.number().int().nonnegative(),
});

export type DoublesScenarioInput = z.infer<typeof DoublesScenarioSchema>;
export type DoublesScenarioResult = z.infer<typeof doublesScenarioResultSchema>;

/**
 * Cenario da AGENDA: sorteia a chave do torneio de duplas (as duas categorias) e
 * agenda a PRIMEIRA rodada da chave nos dias de hoje e amanhã. O email e
 * obrigatorio pelo mesmo
 * motivo dos outros cenarios: nunca rodar "na conta errada" por engano.
 */
export const DoublesAgendaScenarioSchema = z.object({
  primaryUserEmail: z.string().email(),
});

export const doublesAgendaCategoryResultSchema = z.object({
  activeEntries: z.number().int().nonnegative(),
  displayName: z.string(),
  gender: z.string(),
  round1Matches: z.number().int().nonnegative(),
  scheduledMatches: z.number().int().nonnegative(),
});

export const doublesAgendaMatchResultSchema = z.object({
  category: z.string(),
  courtName: z.string(),
  matchDate: z.string(),
  round: z.number().int(),
  sideA: z.string(),
  sideB: z.string(),
  startMinute: z.number().int(),
});

export const doublesAgendaScenarioResultSchema = z.object({
  acceptedInvites: z.number().int().nonnegative(),
  categories: z.array(doublesAgendaCategoryResultSchema),
  courtsAdded: z.number().int().nonnegative(),
  matchesRescheduled: z.number().int().nonnegative(),
  matchesScheduled: z.number().int().nonnegative(),
  /**
   * Proximo passo do fluxo do produto, ou null quando o plantio terminou:
   * `assemble_bracket` (a chave ainda nao existe) ou `start_tournament`.
   */
  nextStep: z.enum(["assemble_bracket", "start_tournament"]).nullable(),
  pairsPlanted: z.number().int().nonnegative(),
  scheduled: z.array(doublesAgendaMatchResultSchema),
  status: z.string(),
  totalMatches: z.number().int().nonnegative(),
  tournamentId: z.string(),
  tournamentName: z.string(),
});

export type DoublesAgendaScenarioInput = z.infer<
  typeof DoublesAgendaScenarioSchema
>;
export type DoublesAgendaScenarioResult = z.infer<
  typeof doublesAgendaScenarioResultSchema
>;
